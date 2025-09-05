import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1) Discover all environments dynamically from recent data (same window as metrics below)
    const envWindowDays = '30 days';
    const envSql = `
      SELECT DISTINCT env_name
      FROM public.affine_results
      WHERE ingested_at > NOW() - INTERVAL '${envWindowDays}'
      ORDER BY env_name ASC;
    `;
    const envRes = await query(envSql);
    const envNames = envRes.rows.map(r => r.env_name);

    // 2) Build a dynamic pivot: one column per environment discovered above
    // Use parameter placeholders to avoid injection and handle arbitrary env names.
    const envSelectPieces = envNames.map((name, i) => {
      const alias = String(name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const paramIndex = i + 1;
      return `MAX(CASE WHEN b.env_name = $${paramIndex} THEN b.avg_score * 100 ELSE NULL END) AS "${alias}"`;
    });
    const dynamicEnvSelect = envSelectPieces.length > 0 ? envSelectPieces.join(',\n        ') + ',\n        ' : '';

    // 3) Compute metrics and return a row per (hotkey, model, revision) with dynamic env columns
    const sql = `
      WITH
        -- Step 1: Calculate base metrics for every miner in every environment.
        base_metrics AS (
          SELECT
            hotkey,
            model,
            revision,
            MAX(uid) AS uid,
            env_name,
            COUNT(*) AS rollouts,
            AVG(score) AS avg_score,
            AVG(latency_seconds) AS avg_latency,
            (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent
          FROM public.affine_results
          WHERE ingested_at > NOW() - INTERVAL '${envWindowDays}' -- Use a recent window for relevance
          GROUP BY hotkey, model, revision, env_name
        ),

        -- Step 2: Find the maximum number of rollouts for each environment.
        env_maximums AS (
          SELECT
            env_name,
            MAX(rollouts) AS max_rollouts
          FROM base_metrics
          GROUP BY env_name
        ),

        -- Step 3: Determine if each miner meets the rollout requirement for EACH environment.
        eligibility_check AS (
          SELECT
            bm.hotkey,
            bm.model,
            bm.revision,
            -- Eligibility rule: rollouts >= 150 + 1% of the max for that environment across all envs they participated in.
            bool_and(bm.rollouts >= (150 + 0.01 * em.max_rollouts)) AS is_eligible
          FROM base_metrics bm
          JOIN env_maximums em ON bm.env_name = em.env_name
          GROUP BY bm.hotkey, bm.model, bm.revision
        ),

        -- Step 4: Overall metrics across all environments for each miner/revision.
        overall_metrics AS (
          SELECT
            hotkey,
            model,
            revision,
            COUNT(*) AS total_rollouts,
            AVG(score) AS overall_avg_score,
            (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent,
            AVG(latency_seconds) AS avg_latency,
            MAX(ingested_at) AS last_rollout_at,
            MAX((extra->'miner_chute'->>'chute_id')) AS chute_id
          FROM public.affine_results
          WHERE ingested_at > NOW() - INTERVAL '${envWindowDays}'
          GROUP BY hotkey, model, revision
        )

      -- Final Step: Pivot env metrics into dynamic columns, and join eligibility + overall metrics.
      SELECT
        b.hotkey,
        b.model,
        b.revision AS rev,
        MAX(b.uid) AS uid,
        ${dynamicEnvSelect}e.is_eligible AS eligible,
        om.overall_avg_score * 100 AS overall_avg_score,
        om.success_rate_percent,
        om.avg_latency,
        om.total_rollouts,
        om.last_rollout_at,
        om.chute_id
      FROM
        base_metrics b
      JOIN
        eligibility_check e ON b.hotkey = e.hotkey AND b.model = e.model AND b.revision = e.revision
      JOIN
        overall_metrics om ON b.hotkey = om.hotkey AND b.model = om.model AND b.revision = om.revision
      GROUP BY
        b.hotkey, b.model, b.revision, e.is_eligible, om.overall_avg_score, om.success_rate_percent, om.avg_latency, om.total_rollouts, om.last_rollout_at, om.chute_id
      ORDER BY
        overall_avg_score DESC;
    `;

    const params = envNames; // used in the dynamic CASE WHEN ... = $N clauses
    const { rows } = await query(sql, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Subnet overview query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

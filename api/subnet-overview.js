import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This advanced query calculates per-miner, per-environment stats,
      -- determines eligibility, and adds overall success rate and latency.
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
          WHERE ingested_at > NOW() - INTERVAL '30 days' -- Use a recent window for relevance
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
            -- The eligibility rule: rollouts >= 150 + 1% of the max for that environment.
            -- We check this for every environment they participated in.
            -- The 'bool_and' aggregate function returns TRUE only if ALL conditions are true.
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
            MAX(ingested_at) AS last_rollout_at
          FROM public.affine_results
          WHERE ingested_at > NOW() - INTERVAL '30 days'
          GROUP BY hotkey, model, revision
        )

      -- Final Step: Pivot env metrics into columns, and join eligibility + overall metrics.
      SELECT
        b.hotkey,
        b.model,
        b.revision AS rev,
        MAX(b.uid) AS uid,
        MAX(CASE WHEN b.env_name = 'SAT' THEN b.avg_score * 100 ELSE NULL END) AS sat,
        MAX(CASE WHEN b.env_name = 'ABD' THEN b.avg_score * 100 ELSE NULL END) AS abd,
        MAX(CASE WHEN b.env_name = 'DED' THEN b.avg_score * 100 ELSE NULL END) AS ded,
        MAX(CASE WHEN b.env_name = 'ELR' THEN b.avg_score * 100 ELSE NULL END) AS elr,
        e.is_eligible AS eligible,
        om.overall_avg_score * 100 AS overall_avg_score,
        om.success_rate_percent,
        om.avg_latency,
        om.total_rollouts,
        om.last_rollout_at
      FROM
        base_metrics b
      JOIN
        eligibility_check e ON b.hotkey = e.hotkey AND b.model = e.model AND b.revision = e.revision
      JOIN
        overall_metrics om ON b.hotkey = om.hotkey AND b.model = om.model AND b.revision = om.revision
      GROUP BY
        b.hotkey, b.model, b.revision, e.is_eligible, om.overall_avg_score, om.success_rate_percent, om.avg_latency, om.total_rollouts, om.last_rollout_at
      ORDER BY
        overall_avg_score DESC;
    `;

    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Subnet overview query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

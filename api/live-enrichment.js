import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { items } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid payload: expected { items: Array<{uid, model}> }' });
    }

    // Sanitize and normalize inputs
    const tuples = [];
    for (const it of items) {
      if (!it) continue;
      const uid = Number(it.uid);
      let model = typeof it.model === 'string' ? it.model : String(it.model ?? '');
      model = model.trim();
      if (!Number.isFinite(uid) || !model) continue;
      tuples.push([uid, model]);
    }

    if (tuples.length === 0) {
      return res.status(200).json([]); // nothing to enrich
    }

    // Build a VALUES list with parameter placeholders safely
    // e.g. ( ($1::int,$2::text,$3::text), ($4::int,$5::text,$6::text), ... )
    const valuesClauses = [];
    const params = [];
    for (let i = 0; i < tuples.length; i++) {
      const base = i * 2;
      valuesClauses.push(`($${base + 1}::int, $${base + 2}::text)`);
      const [uid, model] = tuples[i];
      params.push(uid, model);
    }

    const sql = `
      WITH input(uid, model) AS (
        VALUES
          ${valuesClauses.join(',\n          ')}
      ),
      norm_input AS (
        SELECT DISTINCT lower(trim(model)) AS lmodel
        FROM input
      ),
      model_rows AS (
        SELECT ar.*
        FROM public.affine_results ar
        JOIN norm_input ni
          ON lower(trim(ar.model)) = ni.lmodel
      ),
      model_agg AS (
        SELECT
          lower(trim(model)) AS lmodel,
          NULL::text AS hotkey,
          COUNT(*) AS total_rollouts,
          AVG(score) * 100 AS overall_avg_score,
          (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent,
          AVG(latency_seconds) AS avg_latency,
          MAX(ingested_at) AS last_rollout_at,
          MAX((extra->'miner_chute'->>'chute_id')) AS chute_id
        FROM model_rows
        GROUP BY lower(trim(model))
      )
      SELECT
        i.uid,
        i.model,
        ma.hotkey,
        ma.total_rollouts,
        ma.overall_avg_score,
        ma.success_rate_percent,
        ma.avg_latency,
        ma.last_rollout_at,
        ma.chute_id
      FROM input i
      LEFT JOIN model_agg ma
        ON lower(trim(i.model)) = ma.lmodel;
    `;

    const { rows } = await query(sql, params);
    // rows: [{ uid, model, hotkey, total_rollouts, overall_avg_score, success_rate_percent, avg_latency, last_rollout_at, chute_id }]
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Live enrichment error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      SELECT
          hotkey,
          MAX(uid) AS last_seen_uid,
          model,
          MAX((extra->'miner_chute'->>'chute_id')) AS chute_id,
          COUNT(*) AS total_rollouts,
          AVG(score) AS average_score,
          (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent,
          AVG(latency_seconds) as avg_latency
      FROM public.affine_results
      GROUP BY hotkey, model
      ORDER BY average_score DESC, total_rollouts DESC
      LIMIT 20;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Leaderboard query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

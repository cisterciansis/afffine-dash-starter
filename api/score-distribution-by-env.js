import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const env = (req.query?.env || req.query?.ENV || req.query?.e || '').toString().trim();
  if (!env) {
    return res.status(400).json({ message: 'Missing required query parameter: env' });
  }

  try {
    const sql = `
      WITH miner_scores AS (
        SELECT
          hotkey,
          AVG(score) as avg_score
        FROM public.affine_results
        WHERE
          env_name = $1
          AND ingested_at > NOW() - INTERVAL '14 days'
        GROUP BY hotkey
        HAVING COUNT(*) > 20
      )
      SELECT
        width_bucket(avg_score, 0.0, 1.0, 10) AS score_bucket,
        COUNT(*) AS number_of_miners
      FROM miner_scores
      GROUP BY score_bucket
      ORDER BY score_bucket ASC;
    `;
    const { rows } = await query(sql, [env]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('score-distribution-by-env query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

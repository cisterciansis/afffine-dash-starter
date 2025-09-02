import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      SELECT
        env_name,
        COUNT(*) as total_rollouts,
        AVG(score) as average_score,
        (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 AS success_rate_percent
      FROM
        public.affine_results
      GROUP BY
        env_name
      ORDER BY
        average_score DESC;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Performance-by-env query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

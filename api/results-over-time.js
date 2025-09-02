import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      SELECT
        DATE_TRUNC('DAY', ingested_at) AS period,
        COUNT(*) AS total_rollouts,
        AVG(score) AS average_score
      FROM
        public.affine_results
      WHERE
        ingested_at > NOW() - INTERVAL '30 days'
      GROUP BY
        period
      ORDER BY
        period ASC;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Results-over-time query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

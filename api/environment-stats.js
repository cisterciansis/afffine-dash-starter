import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query aggregates stats for each environment.
      SELECT
          env_name,
          COUNT(*) AS total_rollouts,
          AVG(score) * 100 AS success_rate
      FROM
          public.affine_results
      GROUP BY
          env_name
      ORDER BY
          total_rollouts DESC;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('environment-stats query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

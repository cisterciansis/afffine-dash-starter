import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query gets a distinct, sorted list of all recently active environments.
      SELECT DISTINCT env_name
      FROM public.affine_results
      WHERE ingested_at > NOW() - INTERVAL '14 days' -- Ensures only relevant envs are shown
      ORDER BY env_name ASC;
    `;
    const { rows } = await query(sql);
    const envs = rows.map(r => r.env_name);
    return res.status(200).json(envs);
  } catch (err) {
    console.error('Environments endpoint error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

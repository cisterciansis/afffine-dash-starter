import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      SELECT
        ingested_at,
        hotkey,
        uid,
        model,
        env_name,
        score,
        success
      FROM public.affine_results
      ORDER BY ingested_at DESC
      LIMIT 10;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Activity query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

import { query } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query calculates the average score and latency for each active miner.
      SELECT
          hotkey,
          model,
          AVG(score) AS avg_score,
          AVG(latency_seconds) AS avg_latency
      FROM
          public.affine_results
      WHERE
          -- Only consider recent data to reflect current miner efficiency.
          ingested_at > NOW() - INTERVAL '7 days'
      GROUP BY
          hotkey, model
      HAVING
          -- Filter out inactive miners to keep the plot clean.
          COUNT(*) > 50;
    `;
    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('miner-efficiency query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

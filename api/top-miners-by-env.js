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
      WITH top_miners AS (
        SELECT hotkey
        FROM public.affine_results
        WHERE
          env_name = $1
          AND ingested_at > NOW() - INTERVAL '14 days'
        GROUP BY hotkey
        HAVING COUNT(*) > 20
        ORDER BY AVG(score) DESC, COUNT(*) DESC
        LIMIT 5
      )
      SELECT
        DATE_TRUNC('day', ar.ingested_at)::date AS period,
        ar.hotkey,
        AVG(ar.score) AS average_score
      FROM
        public.affine_results ar
      WHERE
        ar.hotkey IN (SELECT hotkey FROM top_miners)
        AND ar.env_name = $1
        AND ar.ingested_at > NOW() - INTERVAL '30 days'
      GROUP BY
        period, ar.hotkey
      ORDER BY
        period ASC;
    `;
    const { rows } = await query(sql, [env]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('top-miners-by-env query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

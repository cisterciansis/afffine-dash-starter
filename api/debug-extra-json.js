import { query } from './_db.js';

/**
 * GET /api/debug-extra-json
 * Temporary debugging endpoint.
 * Executes a simple query to fetch raw `extra` JSON from the 10 most recent rows
 * in the last 7 days that actually have the `extra` field populated.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const sql = `
      -- This query simply selects the raw 'extra' JSON from the 10 most recent entries
      -- that actually have an 'extra' field populated.
      SELECT
          extra
      FROM
          public.affine_results
      WHERE
          -- Look at recent data
          ingested_at > NOW() - INTERVAL '7 days'
          -- And only at rows where 'extra' is not empty
          AND extra IS NOT NULL
      ORDER BY
          ingested_at DESC
      LIMIT 10;
    `;

    const { rows } = await query(sql);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('debug-extra-json query error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

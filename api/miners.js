export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const upstream = 'http://65.109.19.166:9000/api/miners';
    const r = await fetch(upstream, {
      headers: { Accept: 'application/json' },
      // You can add a timeout via AbortController if desired
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('Upstream /api/miners error:', r.status, r.statusText, text);
      return res.status(502).json({ message: 'Upstream error', status: r.status });
    }

    const data = await r.json();

    // Cache at the edge to reduce load while keeping it fresh
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy /api/miners failed:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
}

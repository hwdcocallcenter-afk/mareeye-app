// ============================================================
//  Mareeye — Backend Server (proxy ammaan ah)
//  Furaha API-ga wuxuu ku jiraa server-ka KELIYA — app-ka ma galo.
// ============================================================
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '15mb' }));                     // sawirrada waaweyn
app.use(express.static(path.join(__dirname, 'public')));      // app-ka front-end

const API_KEY = process.env.ANTHROPIC_API_KEY;                // ka soo qaado Render env
const MODEL   = process.env.MODEL || 'claude-sonnet-5';       // beddel 'claude-haiku-4-5-20251001' si aad qiimaha u yarayso

// --- Endpoint-ka baaritaanka ---
app.post('/api/analyze', async (req, res) => {
  try {
    const { image, mime, prompt } = req.body || {};
    if (!image || !prompt) return res.status(400).json({ error: 'Sawir iyo weydiin waa loo baahan yahay.' });
    if (!API_KEY)          return res.status(500).json({ error: 'ANTHROPIC_API_KEY lama dejin server-ka.' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: image } },
            { type: 'text',  text: prompt }
          ]
        }]
      })
    });

    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message || 'API error' });

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Mareeye server wuu shaqeynayaa — port ' + PORT));

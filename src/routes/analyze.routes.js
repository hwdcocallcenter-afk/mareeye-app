// Route logic moved verbatim from the original server.js — request/response
// contract, status codes, and error messages are byte-for-byte unchanged.
// The only addition is analyzeLimiter (plan §5's cost-control rate limit),
// which only affects behavior once a client exceeds 30 req/hour.
const express = require('express');
const { analyzeLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const API_KEY = process.env.ANTHROPIC_API_KEY;                // ka soo qaado Render env
const MODEL   = process.env.MODEL || 'claude-sonnet-5';       // beddel 'claude-haiku-4-5-20251001' si aad qiimaha u yarayso

router.post('/api/analyze', analyzeLimiter, async (req, res) => {
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

module.exports = router;

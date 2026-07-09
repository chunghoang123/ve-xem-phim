const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VITE_NVIDIA_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('NVIDIA API proxy error:', err);
    res.status(500).json({ error: 'NVIDIA API call failed' });
  }
});

module.exports = router;

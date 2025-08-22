'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

// middleware
app.use(express.json());
app.use(cors());

// serve your frontend (adjust folder if needed)
app.use(express.static(path.join(__dirname, 'feedback')));

// API routes
app.use('/api/staff', require('./routes/staff'));
app.use('/api/feedback', require('./routes/feedback'));

// healthcheck
app.get('/healthz', (_req, res) => res.send('ok'));

// --- SPA fallback (must be last before listen) ---
app.get('/:path(*)', (req, res, next) => {
  // don’t hijack API routes
  if (req.path.startsWith('/api/')) return next();

  res.sendFile(path.join(__dirname, 'feedback', 'index.html'));
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));

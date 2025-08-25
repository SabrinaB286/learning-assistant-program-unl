// app.js
'use strict';
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health for Render
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

// Mount routes but don't crash if a file is missing
function mount(prefix, modPath) {
  try {
    app.use(prefix, require(modPath));
    console.log('[mount]', prefix, '->', modPath);
  } catch (e) {
    console.warn('[mount skipped]', prefix, '->', modPath, '-', e.message);
  }
}

mount('/api/auth', './routes/auth');          // should exist in your repo
mount('/api/feedback', './routes/feedback');  // should exist in your repo
mount('/api/staff', './routes/staff');        // you updated this one

// Serve the frontend (adjust folder name if needed)
const FE_DIR = path.join(__dirname, 'feedback');
app.use('/', express.static(FE_DIR, { extensions: ['html'] }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(FE_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('server listening on', PORT);
});

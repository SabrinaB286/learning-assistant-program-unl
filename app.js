// app.js (server entry)
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const authRouter = require('./server/routes/auth');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Static assets for your front-end
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/routes', express.static(path.join(__dirname, 'routes')));     // front-end scripts
app.use('/feedback', express.static(path.join(__dirname, 'feedback'))); // feedback.js

// API routes
app.use('/api/auth', authRouter);

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// App shell
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 → homepage (so hard refresh works)
app.get('*', (_req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`HTTP server listening on :${port}`));

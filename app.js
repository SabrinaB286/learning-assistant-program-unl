// server.js (or app.js)
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // if you’ll ever split FE/BE to different domains

// serve your frontend (adjust "public" to your actual folder)
// e.g., feedback/ or dist/
app.use(express.static(path.join(__dirname, 'feedback')));

// API routes
app.use('/api/staff', require('./routes/staff'));
app.use('/api/feedback', require('./routes/feedback'));


// healthcheck (Render uses this to know your app is up)
app.get('/healthz', (_req, res) => res.send('ok'));

// fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'feedback', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on :${PORT}`));

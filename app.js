const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

// basic middleware
app.use(express.json());
app.use(cors()); // if FE/BE are same origin this is fine too

// serve your frontend (adjust folder name if needed)
app.use(express.static(path.join(__dirname, 'feedback')));

// API routes — NOTE: path strings start with '/' and are not full URLs
app.use('/api/staff', require('./routes/staff'));
app.use('/api/feedback', require('./routes/feedback'));

// simple healthcheck
app.get('/healthz', (_req, res) => res.send('ok'));

// SPA fallback (keep last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'feedback', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));

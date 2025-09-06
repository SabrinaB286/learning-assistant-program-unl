// app.js
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Static assets (your structure) ----
app.use('/lib',      express.static(path.join(__dirname, 'lib')));
app.use('/public',   express.static(path.join(__dirname, 'public')));
app.use('/feedback', express.static(path.join(__dirname, 'feedback')));
app.use('/routes',   express.static(path.join(__dirname, 'routes')));
app.use(express.static(path.join(__dirname))); // to serve /index.html

// ---- APIs (mounted if present) ----
function tryMount(route, file) {
  try {
    const r = require(file);
    app.use(route, r);
    console.log(`Mounted ${route} from ${file}`);
  } catch (e) {
    console.log(`(note) API ${route} not mounted (${file} not found)`);
  }
}
tryMount('/api/auth',         path.join(__dirname, 'server', 'routes', 'auth'));
tryMount('/api/schedule',     path.join(__dirname, 'server', 'routes', 'schedule'));
tryMount('/api/office-hours', path.join(__dirname, 'server', 'routes', 'officehours'));
tryMount('/api/feedback',     path.join(__dirname, 'server', 'routes', 'feedback'));

// ---- Root and SPA fallback (non-/api goes to index.html) ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Start
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

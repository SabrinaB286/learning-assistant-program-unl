// app.js
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import routes
const authRoutes = require('./server/routes/auth');
const feedbackRoutes = require('./server/routes/feedback');
const scheduleRoutes = require('./server/routes/schedule');
const officehoursRoutes = require('./server/routes/officehours');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/officehours', officehoursRoutes);

// Default route (for SPA or index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Port setup
const PORT = process.env.PORT || 1000;  // ← back to what you had originally
app.listen(PORT, () => {
  console.log(`LA Portal server listening on port ${PORT}`);
});

// backend/app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const staffRoutes = require('./routes/staff');
const feedbackRoutes = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
console.log('Applying middleware...');
app.use(cors());
app.use(bodyParser.json());

// Routes
console.log('Registering routes...');
app.use('/staff', staffRoutes);
app.use('/feedback', feedbackRoutes);
// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
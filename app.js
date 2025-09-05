import cors from 'cors';
// src/app.js
import express from 'express';
import officeHoursRouter from './routes/office-hours.js';

const app = express();

app.use(cors());
app.use(express.json());

// Simple health check for Render
app.get('/healthz', (_req, res) => res.send('ok'));

// Office Hours API
app.use('/api/schedule', officeHoursRouter);

// (Optional) default route
app.get('/', (_req, res) => res.send('Backend is running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});

// app.js

// ---- Imports
const express = require("express");
const path = require("path");
const morgan = require("morgan");
require("dotenv").config();

// ---- App setup
const app = express();

// Middleware
app.use(express.json());
app.use(morgan("dev"));

// ---- Static file directories
const PUBLIC_DIR = path.join(__dirname, "public");
const FEEDBACK_DIR = path.join(__dirname, "feedback");

// Serve static files if they exist
app.use(express.static(PUBLIC_DIR));
app.use(express.static(FEEDBACK_DIR));

// ---- Routes
const authRoutes = require("./server/routes/auth");
const scheduleRoutes = require("./server/routes/schedule");
const officehoursRoutes = require("./server/routes/officehours");

// Mount routes
app.use("/auth", authRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/officehours", officehoursRoutes);

// ---- Boot
const PORT = process.env.PORT || 1000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ LA Portal server listening on 0.0.0.0:${PORT}`);
  console.log(`Primary SPA dir: ${FEEDBACK_DIR}`);
  console.log(
    `Also serving (if they exist): ${[PUBLIC_DIR, FEEDBACK_DIR].join(", ")}`
  );
});

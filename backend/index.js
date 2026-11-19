const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { existsSync, readdirSync } = require('fs');
const { resolve } = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const airRoutes = require('./routes/air');
const waterRoutes = require('./routes/water');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/air', airRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = server;

const express = require('express');
require('dotenv').config();
const cors = require('cors');

const prisma = require('./config');
const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const airRoutes = require('./routes/air');
const waterRoutes = require('./routes/water');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json());

// Auth routes
app.post('/api/auth/register', authRoutes.register);
app.post('/api/auth/login', authRoutes.login);
app.get('/api/auth/me', authRoutes.me);

// Station routes
app.get('/api/stations', stationRoutes.list);
app.post('/api/stations', stationRoutes.create);
app.put('/api/stations/:id', stationRoutes.update);
app.delete('/api/stations/:id', stationRoutes.delete);

// Air Quality routes
app.get('/api/air/latest/:stationId', airRoutes.latest);
app.post('/api/air/readings', airRoutes.createReading);
app.get('/api/air/history/:stationId', airRoutes.history);

// Water Quality routes
app.get('/api/water/latest/:stationId', waterRoutes.latest);
app.post('/api/water/readings', waterRoutes.createReading);
app.get('/api/water/history/:stationId', waterRoutes.history);

// Alert routes
app.post('/api/alerts/generate', alertRoutes.generate);
app.get('/api/alerts', alertRoutes.list);
app.get('/api/alerts/:id', alertRoutes.getById);
app.put('/api/alerts/:id/acknowledge', alertRoutes.acknowledge);
app.put('/api/alerts/:id/resolve', alertRoutes.resolve);

// Report routes
app.get('/api/reports/export', reportRoutes.export);

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

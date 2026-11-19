const express = require('express');
const prisma = require('../config');
const { computeAQI } = require('../utils/aqi');

const router = express.Router();

router.post('/stations/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { timestamp, pollutant, value } = req.body;

    if (!timestamp || !pollutant || !value) {
      return res.status(400).json({ error: 'Timestamp, pollutant, and value required' });
    }

    const station = await prisma.station.findUnique({ where: { id: stationId } });
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const aqi = computeAQI(pollutant, value);

    const reading = await prisma.airReading.create({
      data: { timestamp, pollutant, value, aqi, stationId },
    });

    res.status(201).json({ ...reading, stationName: station.name, stationType: station.stationType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stations/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;

    const readings = await prisma.airReading.findMany({
      where: { stationId },
      include: { station: true },
      orderBy: { timestamp: 'desc' },
      limit: 100,
    });

    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stations/:stationId/latest', async (req, res) => {
  try {
    const { stationId } = req.params;

    const reading = await prisma.airReading.findFirst({
      where: { stationId },
      include: { station: true },
      orderBy: { timestamp: 'desc' },
    });

    res.json(reading);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

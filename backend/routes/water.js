const express = require('express');
const prisma = require('../config');
const { computeWQI } = require('../utils/wqi');

const router = express.Router();

router.post('/stations/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const { timestamp, parameter, value } = req.body;

    if (!timestamp || !parameter || !value) {
      return res.status(400).json({ error: 'Timestamp, parameter, and value required' });
    }

    const station = await prisma.station.findUnique({ where: { id: stationId } });
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const wqi = computeWQI(parameter, value);

    const reading = await prisma.waterReading.create({
      data: { timestamp, parameter, value, wqi, stationId },
    });

    res.status(201).json({ ...reading, stationName: station.name, stationType: station.stationType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stations/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;

    const readings = await prisma.waterReading.findMany({
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

    const reading = await prisma.waterReading.findFirst({
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

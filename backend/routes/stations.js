const express = require('express');
const prisma = require('../config');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stations = await prisma.station.findMany({
      include: { _count: { select: { air_readings: true, water_readings: true } } },
      orderBy: { name: 'asc' },
    });

    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, lat, lng, stationType, userId } = req.body;

    if (!name || !stationType) {
      return res.status(400).json({ error: 'Name and station type required' });
    }

    const existingStation = await prisma.station.findUnique({ where: { name } });
    if (existingStation) {
      return res.status(409).json({ error: 'Station already exists' });
    }

    const station = await prisma.station.create({
      data: { name, lat, lng, stationType, userId },
      include: { _count: { select: { air_readings: true, water_readings: true } } },
    });

    res.status(201).json(station);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const station = await prisma.station.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { air_readings: true, water_readings: true } } },
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json(station);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.station.delete({ where: { id: req.params.id } });
    res.json({ message: 'Station deleted successfully' });
  } catch (err) {
    if (err.code === '2301') {
      return res.status(404).json({ error: 'Station not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

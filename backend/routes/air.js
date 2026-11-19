const express = require('express');
const router = express.Router();
const AirReading = require('../models/AirReading');
const Station = require('../models/Station');

router.get('/latest/:stationId', async (req, res) => {
  try {
    const station = await Station.findById(req.params.stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    const reading = await AirReading.getLatestByStation(req.params.stationId);
    if (!reading) return res.json(null);
    res.json({ aqi: reading.aqi, dominant: reading.dominant, ...POLLUTANTS[reading.dominant] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const station = await Station.findById(req.body.stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    
    const data = {
      ...req.body,
      recordedAt: req.body.recordedAt || new Date(),
    };

    const reading = await AirReading.create(data);
    res.status(201).json(reading);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:stationId', async (req, res) => {
  try {
    const readings = await AirReading.findByStationId(req.params.stationId);
    res.json(readings || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const reading = await AirReading.findById(req.params.id);
    if (!reading) return res.status(404).json({ error: 'Reading not found' });
    const updated = await AirReading.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await AirReading.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

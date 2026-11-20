const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Station = require('../models/Station');
const AirReading = require('../models/AirReading');
const { AQI_SCALE, POLLUTANTS, aqiZones } = require('../utils/aqi');

router.post('/auto-generate', async (req, res) => {
  try {
    const { stationIds } = req.body;
    if (!stationIds || !Array.isArray(stationIds)) 
      return res.status(400).json({ error: 'Invalid stationIds array' });

    for (const sid of stationIds) {
      const readings = await AirReading.findByStationId(sid);
      if (!readings || readings.length === 0) continue;

      const latest = readings[0];
      let shouldCreate = false;
      
      if ('aqi' in latest && typeof latest.aqi === 'number') {
        const zone = aqiZones().find((z) => Number(latest.aqi) >= z.limit);
        if (Number(latest.aqi) >= 200) {
          shouldCreate = true;
        }
      }

      if (shouldCreate) {
        await Alert.create({
          stationId: latest.stationId,
          type: 'AQI_HIGH',
          severity: Number(latest.aqi) >= 300 ? 'HIGH' : 'MEDIUM',
          message: `High AQI (${latest.aqi}) at ${latest.station.name} - Dominant: ${POLLUTANTS[latest.dominant]?.label || latest.dominant}`,
        });
      }
    }

    res.status(201).json({ created: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.findAll(req.query);
    res.json(alerts || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    await Alert.acknowledge(req.params.id);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    await Alert.resolve(req.params.id);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Alert.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

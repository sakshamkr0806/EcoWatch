const express = require('express');
const prisma = require('../config');
const { computeAQI } = require('../utils/aqi');
const { computeWQI } = require('../utils/wqi');

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { from, to, stationId } = req.body;
    const startDate = new Date(from);
    const endDate = new Date(to);

    if (!stationId) {
      return res.status(400).json({ error: 'Station ID required' });
    }

    const airData = await prisma.airReading.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        ...(stationId && { stationId }),
      },
      include: { station: true },
      orderBy: [{ timestamp: 'desc' }],
    });

    const waterData = await prisma.waterReading.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        ...(stationId && { stationId }),
      },
      include: { station: true },
      orderBy: [{ timestamp: 'desc' }],
    });

    const dailyAQISummary = generateDailySummary(airData, computeAQI);
    const dailyWQISummary = generateDailySummary(waterData, computeWQI);

    res.json({
      period: { from: startDate.toISOString(), to: endDate.toISOString() },
      stationId,
      airQuality: dailyAQISummary,
      waterQuality: dailyWQISummary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateDailySummary(readings, calculateIndex) {
  if (!readings.length) return [];

  const byDate = new Map();
  readings.forEach(r => {
    const dateStr = r.timestamp.toISOString().split('T')[0];
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr).push(r);
  });

  return Array.from(byDate.entries()).map(([date, dayReadings]) => ({
    date,
    readings: dayReadings.length,
    avgAQI: calculateIndex(dayReadings).average,
    maxAQI: calculateIndex(dayReadings).maximum,
    minAQI: calculateIndex(dayReadings).minimum,
  }));
}

module.exports = router;

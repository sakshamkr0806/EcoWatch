const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../config');
const fs = require('fs');

async function getFilteredReadings(period, type) {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    
    const now = new Date();
    let endTimestamp;
    let startTimestamp;

    if (period === 'today') {
      endTimestamp = new Date().toDateString();
      startTimestamp = new Date(now - 24 * 60 * 60 * 1000).toDateString();
    } else if (period === 'yesterday') {
      const yesterday = new Date(yesterday);
      startTimestamp = yesterday.toDateString();
      endTimestamp = today.toDateString();
    } else if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toDateString();
      startTimestamp = weekAgo;
      endTimestamp = now.toDateString();
    } else if (period === 'month') {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toDateString();
      startTimestamp = monthAgo;
      endTimestamp = now.toDateString();
    } else if (period === 'all') {
      startTimestamp = null;
      endTimestamp = null;
    }

    const airReadings = await prisma.air_reading.findMany({
      where: {
        ...(startTimestamp ? { recordedAt: { gte: new Date(startTimestamp) } } : {}),
        ...(endTimestamp ? { recordedAt: { lte: new Date(endTimestamp) } } : {}),
        ...(type === 'air' ? { station: { type: 'AIR' } } : {}),
      },
      orderBy: { recordedAt: 'asc' },
    });

    const waterReadings = await prisma.water_reading.findMany({
      where: {
        ...(startTimestamp ? { recordedAt: { gte: new Date(startTimestamp) } } : {}),
        ...(endTimestamp ? { recordedAt: { lte: new Date(endTimestamp) } } : {}),
        ...(type === 'water' ? { station: { type: 'WATER' } } : {}),
      },
      orderBy: { recordedAt: 'asc' },
    });

    return { airReadings, waterReadings };
  } finally {
    await prisma.$disconnect();
  }
}

function generateCSV(data) {
  let lines = ['timestamp,type,value,status,pollutant'];
  
  for (const r of data.airReadings || []) {
    lines.push(`"${r.recordedAt.toISOString()}","AIR",${r.pm25},${r.aqi},${r.dominant}`);
  }
  
  for (const r of data.waterReadings || []) {
    let values = '';
    if (r.ph != null && r.ph > 0) values += `ph=${r.ph} `;
    if (r.do_ != null && r.do_ > 0) values += `do=${r.do_} `;
    if (r.turbidity != null && r.turbidity > 0) values += `turbidity=${r.turbidity} `;
    if (r.tds != null && r.tds > 0) values += `tds=${r.tds}`;
    
    const category = getWQICategory(r.wqi);
    lines.push(`"${r.recordedAt.toISOString()}","WATER",${values},${category?.label || 'Unknown'},`);
  }
  
  return lines.join('\n');
}

router.get('/export', async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const type = req.query.type || 'all'; // air, water, or all
    
    const data = await getFilteredReadings(period, type);
    const csvContent = generateCSV(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report_${period}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

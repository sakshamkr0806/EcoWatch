const express = require('express');
const prisma = require('../config');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, severity, status, relatedStationId } = req.body;

    if (!message || !severity || !status) {
      return res.status(400).json({ error: 'Message, severity, and status required' });
    }

    const alert = await prisma.alert.create({
      data: { message, severity, status, relatedStationId },
    });

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      include: { relatedStation: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: { relatedStation: true },
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.alert.delete({ where: { id: req.params.id } });
    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    if (err.code === '2301') {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

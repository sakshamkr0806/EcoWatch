const prisma = require('../config');

exports.create = async (data) => {
  return await prisma.water_reading.create({ data });
};

exports.findAll = async () => {
  return await prisma.water_reading.findMany();
};

exports.findByStationId = async (stationId) => {
  return await prisma.water_reading.findMany({ 
    where: { stationId },
    orderBy: { recordedAt: 'desc' } 
  });
};

exports.findById = async (id) => {
  return await prisma.water_reading.findUnique({ where: { id } });
};

exports.update = async (id, data) => {
  return await prisma.water_reading.update({ where: { id }, data });
};

exports.delete = async (id) => {
  return await prisma.water_reading.delete({ where: { id } });
};

exports.getLatest = async (stationId) => {
  const readings = await exports.findByStationId(stationId);
  return readings.length > 0 ? { ...readings[0] } : null;
};

const scorePh = (ph) => {
  if (ph >= 6.5 && ph <= 8.5) return 0;
  if (ph < 6.5) return (91 - ph) * 4;
  return (ph - 8.5) * 4;
};

const scoreDo = (do_) => {
  const doVal = Math.min(Math.max(do_ || 0, 0), 14);
  if (doVal >= 7) return 0;
  if (doVal < 3) return 90;
  return Math.round((91 - doVal * 5));
};

exports.computeWQI = (ph, do_) => {
  const phScore = scorePh(ph);
  const doScore = scoreDo(do_);

  const scores = [phScore, doScore];
  if (scores.some(s => s === 91)) return 91;
  
  const sum = scores.reduce((a, b) => a + b, 0);
  const wqi = Math.round(sum / (scores.length || 1));
  
  let category = 'Good';
  if (wqi >= 61 && wqi <= 100) category = 'Normal';
  else if (wqi > 100 && wqi <= 250) category = 'Poor';
  else if (wqi > 250 && wqi <= 450) category = 'Very Poor';
  else category = 'Severe';

  return { wqi, category };
};

module.exports = exports;

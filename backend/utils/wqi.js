const scorePh = (ph) => {
  if (ph >= 6.5 && ph <= 8.5) return 0;
  if (ph < 6.5) return (91 - ph) * 4;
  return (ph - 8.5) * 4;
};

const scoreDo = (do_) => {
  const doVal = Math.min(Math.max(do_ || 0, 0), 14);
  if (doVal >= 7) return 0;
  if (doVal < 3) return 90;
  return Math.round(91 - doVal * 5);
};

const computeWQI = (ph, do_) => {
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

module.exports = {
  scorePh,
  scoreDo,
  computeWQI,
};

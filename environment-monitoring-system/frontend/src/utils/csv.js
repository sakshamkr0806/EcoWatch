// Turn rows of arrays into a CSV file and download it in the browser.

function csvCell(value) {
  const s = String(value ?? '');
  // Quote cells that contain commas, quotes or newlines.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(filename, rows) {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

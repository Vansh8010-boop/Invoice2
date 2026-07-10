const XLSX = require('xlsx');
const { loadWorkbook } = require('../lib/workbook');

module.exports = async function handler(req, res) {
  try {
    const wb = await loadWorkbook();
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="writingale-data.xlsx"');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

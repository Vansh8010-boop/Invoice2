const {
  loadWorkbook,
  saveWorkbook,
  sheetToObjects,
  objectsToSheet,
  CLIENT_HEADERS,
} = require('../lib/workbook');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const wb = await loadWorkbook();
    let clients = sheetToObjects(wb, 'Clients');

    if (req.method === 'GET') {
      return res.status(200).json({ clients });
    }

    if (req.method === 'POST') {
      const { id, name, company, contact } = req.body || {};
      if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
      if (clients.some((c) => c['ID Code'] === id)) {
        return res.status(409).json({ error: 'that ID code is already in use' });
      }
      clients.push({
        'ID Code': id,
        Name: name,
        'Company/Theme': company || '',
        Contact: contact || '',
        Joined: new Date().toISOString().slice(0, 10),
        Orders: 0,
      });
      objectsToSheet(wb, 'Clients', CLIENT_HEADERS, clients);
      await saveWorkbook(wb);
      // Also update the Invoice Log sheet's sheet-order so both tabs stay in sync.
      return res.status(201).json({ clients });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      clients = clients.filter((c) => c['ID Code'] !== id);
      objectsToSheet(wb, 'Clients', CLIENT_HEADERS, clients);
      await saveWorkbook(wb);
      return res.status(200).json({ clients });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

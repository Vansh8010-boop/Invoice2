const {
  loadWorkbook,
  saveWorkbook,
  sheetToObjects,
  objectsToSheet,
  LOG_HEADERS,
  CLIENT_HEADERS,
} = require('../lib/workbook');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const wb = await loadWorkbook();
    let items = sheetToObjects(wb, 'Invoice Log');

    if (req.method === 'GET') {
      return res.status(200).json({ items });
    }

    // Add one or more new line items in a single invoice batch.
    if (req.method === 'POST') {
      const { rows, invoiceDetails, dueDate } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'rows (array) is required' });
      }
      let nextSr = items.reduce((max, r) => Math.max(max, Number(r['SR. NO.']) || 0), 0) + 1;

      const newRows = rows.map((r) => ({
        'SR. NO.': nextSr++,
        'PERSON(S) OF INTEREST': r.person || '',
        'COMPANY/THEME': r.company || '',
        'TOPIC/TOPIC CODE': r.topic || '',
        'Date Of Delivery': r.deliveryDate || '',
        'Date of Payment': '',
        Price: Number(r.price) || 0,
        'Invoice Details': invoiceDetails || '',
        'Client ID': r.clientId || '',
        Contact: r.contact || '',
        Platform: r.platform || '',
        Scope: r.scope || '',
        'Due Date': dueDate || '',
      }));

      items = [...items, ...newRows];
      objectsToSheet(wb, 'Invoice Log', LOG_HEADERS, items);

      // Keep the Clients tab in sync: bump the order count for any client
      // referenced by these new rows so both tabs update together.
      const clientId = rows.find((r) => r.clientId)?.clientId;
      if (clientId) {
        const clients = sheetToObjects(wb, 'Clients');
        const idx = clients.findIndex((c) => c['ID Code'] === clientId);
        if (idx !== -1) {
          clients[idx].Orders = (Number(clients[idx].Orders) || 0) + rows.length;
          objectsToSheet(wb, 'Clients', CLIENT_HEADERS, clients);
        }
      }

      await saveWorkbook(wb);
      return res.status(201).json({ items });
    }

    // Update a single row — used for "mark as paid" and inline edits.
    if (req.method === 'PATCH') {
      const { srNo, invoiceDetails, updates } = req.body || {};
      if (invoiceDetails) {
        // Bulk update: mark every row in this invoice batch as paid at once.
        const paymentDate = updates && updates['Date of Payment'];
        items = items.map((r) =>
          r['Invoice Details'] === invoiceDetails ? { ...r, 'Date of Payment': paymentDate } : r
        );
      } else {
        const idx = items.findIndex((r) => Number(r['SR. NO.']) === Number(srNo));
        if (idx === -1) return res.status(404).json({ error: 'row not found' });
        items[idx] = { ...items[idx], ...updates };
      }
      objectsToSheet(wb, 'Invoice Log', LOG_HEADERS, items);
      await saveWorkbook(wb);
      return res.status(200).json({ items });
    }

    if (req.method === 'DELETE') {
      const { srNo } = req.body || {};
      items = items.filter((r) => Number(r['SR. NO.']) !== Number(srNo));
      objectsToSheet(wb, 'Invoice Log', LOG_HEADERS, items);
      await saveWorkbook(wb);
      return res.status(200).json({ items });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

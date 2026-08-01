const { supabaseAdmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('invoice_log')
        .select('*')
        .order('sr_no', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ items: data });
    }

    // Add one or more new line items in a single invoice batch.
    if (req.method === 'POST') {
      const { rows, invoiceDetails, dueDate } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'rows (array) is required' });
      }

      const toInsert = rows.map((r) => ({
        person: r.person || '',
        company_theme: r.company || '',
        topic: r.topic || '',
        date_of_delivery: r.deliveryDate || null,
        date_of_payment: null,
        price: Number(r.price) || 0,
        invoice_details: invoiceDetails || '',
        client_id: r.clientId || null,
        contact: r.contact || '',
        platform: r.platform || '',
        scope: r.scope || '',
        due_date: dueDate || null,
      }));

      const { data, error } = await supabaseAdmin.from('invoice_log').insert(toInsert).select();
      if (error) throw error;

      // Keep the Clients tab in sync: atomically bump the order count for
      // any client referenced by these new rows.
      const clientId = rows.find((r) => r.clientId)?.clientId;
      if (clientId) {
        const { error: rpcErr } = await supabaseAdmin.rpc('increment_client_orders', {
          p_client_id: clientId,
          p_amount: rows.length,
        });
        if (rpcErr) console.error('order count bump failed:', rpcErr);
      }

      return res.status(201).json({ items: data });
    }

    // Update a single row (mark paid / edit) or a whole invoice batch at once.
    if (req.method === 'PATCH') {
      const { srNo, invoiceDetails, updates } = req.body || {};
      let query = supabaseAdmin.from('invoice_log').update(mapUpdates(updates));
      query = invoiceDetails ? query.eq('invoice_details', invoiceDetails) : query.eq('sr_no', srNo);
      const { data, error } = await query.select();
      if (error) throw error;
      return res.status(200).json({ items: data });
    }

    if (req.method === 'DELETE') {
      const { srNo } = req.body || {};
      const { error } = await supabaseAdmin.from('invoice_log').delete().eq('sr_no', srNo);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

// Translate the display-style keys the frontend sends (matching the
// original spreadsheet headers) into the snake_case Postgres columns.
function mapUpdates(updates) {
  const map = {
    'Date of Payment': 'date_of_payment',
    'Date Of Delivery': 'date_of_delivery',
    'Invoice Details': 'invoice_details',
    Price: 'price',
  };
  const out = {};
  Object.entries(updates || {}).forEach(([k, v]) => {
    out[map[k] || k] = v;
  });
  return out;
}

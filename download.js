const XLSX = require('xlsx');
const { supabaseAdmin } = require('../lib/supabase');

// Same column names/order as the client's original spreadsheet, with the
// extra app-only fields riding along after "Invoice Details".
const LOG_HEADERS = [
  'SR. NO.', 'PERSON(S) OF INTEREST', 'COMPANY/THEME', 'TOPIC/TOPIC CODE',
  'Date Of Delivery', 'Date of Payment', 'Price', 'Invoice Details',
  'Client ID', 'Contact', 'Platform', 'Scope', 'Due Date',
];
const CLIENT_HEADERS = ['ID Code', 'Name', 'Company/Theme', 'Contact', 'Joined', 'Orders'];

module.exports = async function handler(req, res) {
  try {
    const [{ data: items, error: e1 }, { data: clients, error: e2 }] = await Promise.all([
      supabaseAdmin.from('invoice_log').select('*').order('sr_no'),
      supabaseAdmin.from('clients').select('*').order('joined'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const logRows = items.map((r) => ({
      'SR. NO.': r.sr_no,
      'PERSON(S) OF INTEREST': r.person,
      'COMPANY/THEME': r.company_theme,
      'TOPIC/TOPIC CODE': r.topic,
      'Date Of Delivery': r.date_of_delivery || '',
      'Date of Payment': r.date_of_payment || '',
      Price: r.price,
      'Invoice Details': r.invoice_details,
      'Client ID': r.client_id || '',
      Contact: r.contact,
      Platform: r.platform,
      Scope: r.scope,
      'Due Date': r.due_date || '',
    }));
    const clientRows = clients.map((c) => ({
      'ID Code': c.id_code,
      Name: c.name,
      'Company/Theme': c.company_theme,
      Contact: c.contact,
      Joined: c.joined,
      Orders: c.orders,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([LOG_HEADERS, ...logRows.map((r) => LOG_HEADERS.map((h) => r[h] ?? ''))]),
      'Invoice Log'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([CLIENT_HEADERS, ...clientRows.map((r) => CLIENT_HEADERS.map((h) => r[h] ?? ''))]),
      'Clients'
    );

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="writingale-data.xlsx"');
    return res.status(200).send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

const { supabaseAdmin } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.from('clients').select('*').order('joined');
      if (error) throw error;
      return res.status(200).json({ clients: data });
    }

    if (req.method === 'POST') {
      const { id, name, company, contact } = req.body || {};
      if (!id || !name) return res.status(400).json({ error: 'id and name are required' });

      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id_code')
        .eq('id_code', id)
        .maybeSingle();
      if (existing) return res.status(409).json({ error: 'that ID code is already in use' });

      const { data, error } = await supabaseAdmin
        .from('clients')
        .insert({ id_code: id, name, company_theme: company || '', contact: contact || '' })
        .select();
      if (error) throw error;
      return res.status(201).json({ clients: data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const { error } = await supabaseAdmin.from('clients').delete().eq('id_code', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

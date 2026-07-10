const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ---- Column schema -------------------------------------------------------
// The first 8 columns match the client's existing spreadsheet exactly.
// Columns after "Invoice Details" are extra fields the app needs internally
// (client code, contact, platform, scope, status) — they ride along in the
// same file without disturbing the look of the original 8 columns.
const LOG_HEADERS = [
  'SR. NO.',
  'PERSON(S) OF INTEREST',
  'COMPANY/THEME',
  'TOPIC/TOPIC CODE',
  'Date Of Delivery',
  'Date of Payment',
  'Price',
  'Invoice Details',
  'Client ID',
  'Contact',
  'Platform',
  'Scope',
  'Due Date',
];

const CLIENT_HEADERS = ['ID Code', 'Name', 'Company/Theme', 'Contact', 'Joined', 'Orders'];

const BLOB_PATH = 'writingale-data.xlsx';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'workbook.xlsx');
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

function emptyWorkbook() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([LOG_HEADERS]), 'Invoice Log');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CLIENT_HEADERS]), 'Clients');
  return wb;
}

async function loadWorkbook() {
  try {
    if (useBlob) {
      const { head } = require('@vercel/blob');
      let meta;
      try {
        meta = await head(BLOB_PATH);
      } catch (e) {
        return emptyWorkbook(); // nothing uploaded yet
      }
      const res = await fetch(meta.url);
      const buf = await res.arrayBuffer();
      return XLSX.read(buf, { type: 'array' });
    } else {
      if (!fs.existsSync(LOCAL_PATH)) return emptyWorkbook();
      const buf = fs.readFileSync(LOCAL_PATH);
      return XLSX.read(buf, { type: 'buffer' });
    }
  } catch (e) {
    console.error('loadWorkbook failed, starting from an empty workbook:', e);
    return emptyWorkbook();
  }
}

async function saveWorkbook(wb) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  if (useBlob) {
    const { put } = require('@vercel/blob');
    await put(BLOB_PATH, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } else {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PATH, buf);
  }
}

function sheetToObjects(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function objectsToSheet(wb, name, headers, rows) {
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (!wb.Sheets[name]) {
    wb.SheetNames.push(name);
  }
  wb.Sheets[name] = ws;
}

module.exports = {
  loadWorkbook,
  saveWorkbook,
  sheetToObjects,
  objectsToSheet,
  LOG_HEADERS,
  CLIENT_HEADERS,
};

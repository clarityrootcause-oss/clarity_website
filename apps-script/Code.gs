const FIXED = ['Time', 'Name', 'Email'];

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.secret !== PropertiesService.getScriptProperties().getProperty('SECRET')) return reply('forbidden');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    save(toValues(data));
    return reply('ok');
  } catch (err) {
    return reply('error: ' + err.message);
  } finally {
    lock.releaseLock();
  }
}

function save(values) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const isNew = sheet.getLastRow() === 0;
  let header = isNew ? [] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!isNew && !FIXED.every((name, i) => header[i] === name)) throw new Error('Header row does not start with ' + FIXED.join(', '));

  const missing = Object.keys(values).filter((key) => !header.includes(key));
  if (missing.length) {
    header = header.concat(missing);
    if (header.length > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), header.length - sheet.getMaxColumns());
    sheet.getRange(1, header.length - missing.length + 1, 1, missing.length).setValues([missing]);
  }
  if (isNew) sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');

  sheet.appendRow(header.map((key) => plainText(values[key])));
  syncTable(sheet);
}

function syncTable(sheet) {
  const id = SpreadsheetApp.getActiveSpreadsheet().getId();
  const sheetId = sheet.getSheetId();
  const range = { sheetId, startRowIndex: 0, endRowIndex: sheet.getLastRow(), startColumnIndex: 0, endColumnIndex: sheet.getLastColumn() };

  const info = Sheets.Spreadsheets.get(id, { fields: 'sheets(properties/sheetId,tables(tableId,range))' });
  const table = (info.sheets.find((s) => s.properties.sheetId === sheetId).tables || [])[0];
  if (table && table.range.endRowIndex === range.endRowIndex && table.range.endColumnIndex === range.endColumnIndex) return;

  const request = table
    ? { updateTable: { table: { tableId: table.tableId, range }, fields: 'range' } }
    : { addTable: { table: { name: 'Submissions', range } } };
  Sheets.Spreadsheets.batchUpdate({ requests: [request] }, id);
}

function toValues(data) {
  const values = { Time: new Date(), Name: data.name, Email: data.email };
  data.answers.forEach(([section, question, answer]) => {
    const base = section + ' — ' + question;
    let key = base;
    let n = 1;
    while (key in values) key = base + ' (' + ++n + ')';
    values[key] = answer;
  });
  return values;
}

function plainText(value) {
  if (value === undefined) return '';
  return typeof value === 'string' && /^\s*[=+@-]/.test(value) ? "'" + value : value;
}

function reply(text) {
  return ContentService.createTextOutput(text);
}

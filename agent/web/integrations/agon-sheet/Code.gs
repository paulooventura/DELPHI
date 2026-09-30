/**
 * Agon enrollment sheet — Google Apps Script web app.
 *
 * SETUP (one time, ~5 minutes)
 *  1. Create a Google Sheet (e.g. "Agon Enrollments"). Extensions → Apps Script.
 *  2. Replace Code.gs with this file. Save.
 *  3. Project Settings → Script properties → add:
 *       AGON_SECRET   = a long random string (the same value goes in Vercel)
 *       NOTIFY_EMAIL  = (optional) address to ping on each new enrollment
 *  4. Run `setup` once from the editor and approve the permissions prompt.
 *     It creates the "Enrollments" tab, headers, and the status dropdown.
 *  5. Deploy → New deployment → type "Web app"
 *       Execute as: Me      Who has access: Anyone
 *     Copy the /exec URL.
 *  6. In Vercel (DELPHI project → Settings → Environment Variables, Production):
 *       AGON_SHEET_WEBHOOK_URL = the /exec URL
 *       AGON_SHEET_SECRET      = the AGON_SECRET value
 *     Redeploy so the env vars take effect.
 *
 * APPROVING
 *  New rows arrive with status "pending". Change status to "approved" and the
 *  entry shows in the public Agon directory within ~5 minutes. "rejected" or
 *  "pending" rows never leave the sheet. Email, phone, details, and notes are
 *  never sent to the public directory.
 *
 * After editing this script, Deploy → Manage deployments → edit → New version,
 * or the /exec URL keeps serving the old code.
 */

var SHEET_NAME = 'Enrollments';
var HEADERS = [
  'id', 'submitted_at', 'status', 'kind', 'display_name', 'city', 'headline',
  'about', 'link', 'contact_email', 'phone', 'details', 'source', 'notes'
];
var PUBLIC = ['id', 'kind', 'display_name', 'city', 'headline', 'about', 'link'];
var KINDS = ['venue', 'investor', 'promoter', 'role'];

function setup() {
  var sh = sheet_();
  var status = sh.getRange(2, HEADERS.indexOf('status') + 1, sh.getMaxRows() - 1, 1);
  status.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['pending', 'approved', 'rejected'], true)
      .setAllowInvalid(false)
      .build()
  );
  sh.setFrozenRows(1);
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad-json' });
  }

  var secret = PropertiesService.getScriptProperties().getProperty('AGON_SECRET');
  if (!secret || body.secret !== secret) return json_({ ok: false, error: 'forbidden' });

  if (body.action === 'enroll') return enroll_(body.row || {}, body.meta || {});
  if (body.action === 'directory') return directory_();
  return json_({ ok: false, error: 'unknown-action' });
}

function doGet() {
  return json_({ ok: false, error: 'post-only' });
}

function enroll_(row, meta) {
  if (KINDS.indexOf(row.kind) < 0 || !row.display_name || !row.contact_email) {
    return json_({ ok: false, error: 'invalid' });
  }
  var id = Utilities.getUuid().slice(0, 8);
  var values = {
    id: id,
    submitted_at: new Date(),
    status: 'pending',
    source: safe_(String(meta.source || 'agon')),
    notes: ''
  };
  HEADERS.forEach(function (h) {
    if (!(h in values)) values[h] = safe_(String(row[h] == null ? '' : row[h]));
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow(HEADERS.map(function (h) { return values[h]; }));
  } finally {
    lock.releaseLock();
  }

  notify_(values);
  return json_({ ok: true, id: id });
}

function directory_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, entries: [] });
  var data = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var col = {};
  HEADERS.forEach(function (h, i) { col[h] = i; });
  var entries = [];
  data.forEach(function (r) {
    if (String(r[col.status]).toLowerCase() !== 'approved') return;
    var out = {};
    PUBLIC.forEach(function (h) { out[h] = String(r[col[h]]); });
    entries.push(out);
  });
  entries.reverse();
  return json_({ ok: true, entries: entries });
}

function notify_(v) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  try {
    MailApp.sendEmail({
      to: to,
      subject: 'Agon enrollment: ' + v.kind + ' — ' + v.display_name,
      body: [
        v.display_name + ' (' + v.kind + ') · ' + v.city,
        v.headline,
        '',
        v.details,
        '',
        v.about,
        '',
        'Contact: ' + v.contact_email + (v.phone ? ' · ' + v.phone : ''),
        'Link: ' + v.link,
        '',
        'Approve by setting status to "approved": ' + SpreadsheetApp.getActive().getUrl()
      ].join('\n')
    });
  } catch (err) {
    console.warn('notify failed: ' + err);
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function safe_(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

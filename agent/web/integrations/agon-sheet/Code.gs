/**
 * Pneuma Mundi sheet — Agon enrollments + beta usage telemetry.
 * Google Apps Script web app.
 *
 * SETUP (one time, ~5 minutes)
 *  1. Create a Google Sheet (e.g. "Pneuma Mundi — Beta"). Extensions → Apps Script.
 *  2. Replace Code.gs with this file. Save.
 *  3. Project Settings → Script properties → add:
 *       AGON_SECRET   = a long random string (the same value goes in Vercel)
 *       NOTIFY_EMAIL  = (optional) address to ping on each new enrollment
 *  4. Run `setup` once from the editor and approve the permissions prompt.
 *     It creates the Enrollments, Sessions, Events, and Dashboard tabs.
 *     Re-running `setup` rebuilds the Dashboard formulas (data is untouched).
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
 * USAGE TELEMETRY
 *  Sessions: one row per visible stretch of a visit (a session can have
 *  several segments — sum them). Seconds per screen in the *_s columns.
 *  Events: session_start rows (one per visit) + every tap (button label with
 *  digits blanked) + named feature events. Anonymous: random visitor id, no
 *  names unless the link carried ?from=<tag>. Paulo's own devices: open the
 *  app once with ?notrack=1 so his use doesn't skew the numbers.
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

var SCREENS = [
  'splash', 'gate', 'home', 'aether', 'heliodrome', 'psyche', 'cast',
  'atlas', 'senses', 'oracle', 'tools', 'about', 'agon', 'mouseion'
];
var SESSION_HEADERS = [
  'received_at', 'session_id', 'visitor_id', 'segment', 'from', 'visit_number',
  'session_started_at', 'segment_started_at', 'segment_ended_at', 'active_s', 'taps'
].concat(SCREENS.map(function (s) { return s + '_s'; })).concat([
  'other_s', 'entry_path', 'exit_path', 'referrer', 'device', 'os', 'browser',
  'viewport', 'city', 'region', 'country', 'build'
]);
var EVENT_HEADERS = [
  'received_at', 'at', 'session_id', 'visitor_id', 'event', 'screen', 'detail',
  'from', 'city', 'country', 'device', 'os', 'browser', 'referrer'
];

function setup() {
  tab_('Sessions', SESSION_HEADERS);
  tab_('Events', EVENT_HEADERS);
  dashboard_();
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
  if (body.action === 'track') return track_(body.session || {}, body.events || []);
  return json_({ ok: false, error: 'unknown-action' });
}

function track_(s, events) {
  if (!s.session_id || !s.visitor_id) return json_({ ok: false, error: 'invalid' });
  var now = new Date();
  var asDate = function (v) { return v ? new Date(Number(v)) : ''; };
  var sessionRow = SESSION_HEADERS.map(function (h) {
    if (h === 'received_at') return now;
    if (/_at$/.test(h)) return asDate(s[h]);
    var v = s[h];
    return v == null ? '' : (typeof v === 'number' ? v : safe_(String(v)));
  });
  var eventRows = (events || []).slice(0, 200).map(function (e) {
    return [
      now, asDate(e.at), s.session_id, s.visitor_id, safe_(String(e.event || '')),
      safe_(String(e.screen || '')), safe_(String(e.detail || '')), s.from || '',
      s.city || '', s.country || '', s.device || '', s.os || '', s.browser || '',
      e.event === 'session_start' ? (s.referrer || '') : ''
    ];
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = tab_('Sessions', SESSION_HEADERS);
    ss.getRange(ss.getLastRow() + 1, 1, 1, SESSION_HEADERS.length).setValues([sessionRow]);
    if (eventRows.length) {
      var es = tab_('Events', EVENT_HEADERS);
      es.getRange(es.getLastRow() + 1, 1, eventRows.length, EVENT_HEADERS.length).setValues(eventRows);
    }
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function tab_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function col_(headers, name) {
  var n = headers.indexOf(name) + 1;
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Formula-only dashboard; rebuilt by setup(), never touches data tabs. */
function dashboard_() {
  var ss = SpreadsheetApp.getActive();
  var d = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard', 0);
  d.clear();
  var S = function (n) { return col_(SESSION_HEADERS, n); };
  var E = function (n) { return col_(EVENT_HEADERS, n); };
  var sr = function (n) { return 'Sessions!' + S(n) + '2:' + S(n); };
  var er = function (n) { return 'Events!' + E(n) + '2:' + E(n); };
  var ev = 'Events!A:' + E('referrer');
  var q = function (sql) { return '=IFERROR(QUERY(' + ev + ',"' + sql + '",1),"no data yet")'; };
  var bold = function (a1) { d.getRange(a1).setFontWeight('bold'); };

  d.getRange('A1').setValue('Pneuma Mundi — beta usage').setFontSize(14).setFontWeight('bold');

  var totals = [
    ['Visitors (unique devices)', '=COUNTUNIQUE(' + sr('visitor_id') + ')'],
    ['Visits', '=COUNTIF(' + er('event') + ',"session_start")'],
    ['Returning visitors', '=IFERROR(COUNTUNIQUE(FILTER(' + sr('visitor_id') + ',' + sr('visit_number') + '>1)),0)'],
    ['Avg minutes per visit', '=IFERROR(SUM(' + sr('active_s') + ')/COUNTUNIQUE(' + sr('session_id') + ')/60,0)'],
    ['Total hours in app', '=SUM(' + sr('active_s') + ')/3600'],
    ['Taps', '=SUM(' + sr('taps') + ')']
  ];
  d.getRange(3, 1, totals.length, 2).setValues(totals);
  d.getRange(6, 2, 2, 1).setNumberFormat('0.0');

  d.getRange('A11').setValue('Time per screen');
  bold('A11');
  var screenRows = [['Screen', 'Minutes', 'Share']];
  SCREENS.concat(['other']).forEach(function (s) {
    var r = sr(s + '_s');
    screenRows.push([s, '=SUM(' + r + ')/60', '=IFERROR(SUM(' + r + ')/SUM(' + sr('active_s') + '),0)']);
  });
  d.getRange(12, 1, screenRows.length, 3).setValues(screenRows);
  d.getRange(13, 2, screenRows.length - 1, 1).setNumberFormat('0.0');
  d.getRange(13, 3, screenRows.length - 1, 1).setNumberFormat('0%');
  bold('A12:C12');

  // Growing lists sit side by side so they never spill into each other.
  var blocks = [
    ['E2', 'Visits per day', 'E3', q("select toDate(B), count(C) where E = 'session_start' group by toDate(B) order by toDate(B) desc label toDate(B) 'day', count(C) 'visits'")],
    ['H2', 'Who (?from= links)', 'H3', q("select H, count(C) where E = 'session_start' and H <> '' group by H order by count(C) desc label H 'from', count(C) 'visits'")],
    ['K2', 'Came from (referrer)', 'K3', q("select N, count(C) where E = 'session_start' group by N order by count(C) desc label N 'referrer', count(C) 'visits'")],
    ['N2', 'Most-tapped buttons', 'N3', q("select F, G, count(G) where E = 'tap' and G <> '' group by F, G order by count(G) desc limit 60 label F 'screen', G 'button', count(G) 'taps'")],
    ['R2', 'Feature events', 'R3', q("select E, count(E) where E <> 'tap' and E <> 'session_start' group by E order by count(E) desc label E 'event', count(E) 'count'")],
    ['U2', 'Cities', 'U3', q("select I, J, count(C) where E = 'session_start' group by I, J order by count(C) desc limit 40 label I 'city', J 'country', count(C) 'visits'")],
    ['Y2', 'Devices', 'Y3', q("select K, L, M, count(C) where E = 'session_start' group by K, L, M order by count(C) desc label K 'device', L 'os', M 'browser', count(C) 'visits'")]
  ];
  blocks.forEach(function (b) {
    d.getRange(b[0]).setValue(b[1]);
    bold(b[0]);
    d.getRange(b[2]).setFormula(b[3]);
  });
  d.setFrozenRows(1);
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

/* Pneuma Mundi usage telemetry — anonymous, beta tuning only.
 *
 * Records: time per screen (while visible), taps on buttons/tabs (label with
 * digits blanked), named feature events, entry path, ?from= tag, visit count.
 * Never records typed text, birth data, or anything inside [data-pm-private];
 * on private screens taps are logged only by their data-pm name.
 *
 * Opt out on a device: open any page with ?notrack=1 (undo with ?track=1).
 * Honors Global Privacy Control. Silent on localhost.
 *
 * API: pmTrack.screen(name)  pmTrack.event(name, detail?)
 */
(function () {
  "use strict";
  if (window.pmTrack) return;

  var ENDPOINT = "/api/pm/track";
  var PRIVATE_SCREENS = { psyche: 1 };
  var IDLE_MS = 5 * 60 * 1000;
  var FLUSH_EVERY_MS = 4 * 60 * 1000;
  var MAX_EVENTS = 200;

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  var ls = store("localStorage");
  var ss = store("sessionStorage");
  function get(s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(s, k, v) { try { if (s) s.setItem(k, v); } catch (e) { /* private mode */ } }
  function rid() {
    var a = new Uint8Array(9);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  var q = new URLSearchParams(location.search);
  if (q.get("notrack") === "1") set(ls, "pm-notrack", "1");
  if (q.get("track") === "1") { try { ls && ls.removeItem("pm-notrack"); } catch (e) { /* ignore */ } }
  var off =
    get(ls, "pm-notrack") === "1" ||
    navigator.globalPrivacyControl === true ||
    /^\/admin/.test(location.pathname) ||
    /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);

  var noop = function () {};
  var pending = Array.isArray(window.__pmq) ? window.__pmq : [];
  window.__pmq = undefined;
  if (off) {
    window.pmTrack = { screen: noop, event: noop, enabled: false };
    return;
  }

  var vid = get(ls, "pm-vid");
  if (!vid) { vid = rid(); set(ls, "pm-vid", vid); }

  var from = (q.get("from") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  if (from) { set(ss, "pm-from", from); if (!get(ls, "pm-first-from")) set(ls, "pm-first-from", from); }
  else from = get(ss, "pm-from") || get(ls, "pm-first-from") || "";

  var sid = get(ss, "pm-sid");
  var newSession = !sid;
  if (newSession) {
    sid = rid();
    set(ss, "pm-sid", sid);
    set(ss, "pm-started", String(Date.now()));
    set(ss, "pm-entry", location.pathname);
    set(ss, "pm-ref", (document.referrer || "").slice(0, 200));
    set(ls, "pm-visits", String((parseInt(get(ls, "pm-visits") || "0", 10) || 0) + 1));
  }
  var segment = parseInt(get(ss, "pm-seg") || "0", 10) || 0;

  var screen = "";
  var screenSince = 0;
  var lastInput = Date.now();
  var visible = document.visibilityState !== "hidden";
  var acc = {};
  var events = [];
  var taps = 0;
  var segStart = Date.now();

  function now() { return Date.now(); }
  function counting() { return visible && now() - lastInput < IDLE_MS; }

  function bank() {
    if (screen && screenSince) {
      var t = now();
      if (counting()) acc[screen] = (acc[screen] || 0) + (t - screenSince);
      screenSince = t;
    }
  }

  function clean(s, n) {
    return String(s || "").replace(/\s+/g, " ").replace(/\d/g, "#").trim().slice(0, n);
  }

  function push(name, detail) {
    if (events.length >= MAX_EVENTS) return;
    events.push({ t: now(), n: clean(name, 40).toLowerCase().replace(/[^a-z0-9_.:#-]/g, "_"), s: screen, d: clean(detail, 60) });
  }

  function flush() {
    bank();
    var active = 0;
    var screens = {};
    Object.keys(acc).forEach(function (k) {
      var sec = Math.round(acc[k] / 1000);
      if (sec > 0) { screens[k] = sec; active += sec; }
    });
    if (!active && !events.length) return;
    segment += 1;
    set(ss, "pm-seg", String(segment));
    var body = JSON.stringify({
      v: 1,
      sid: sid,
      vid: vid,
      seg: segment,
      from: from,
      visit: parseInt(get(ls, "pm-visits") || "1", 10) || 1,
      started: parseInt(get(ss, "pm-started") || String(segStart), 10),
      segStart: segStart,
      ended: now(),
      active: active,
      taps: taps,
      screens: screens,
      events: events,
      entry: get(ss, "pm-entry") || location.pathname,
      ref: get(ss, "pm-ref") || "",
      path: location.pathname,
      vw: Math.round(window.innerWidth),
      vh: Math.round(window.innerHeight)
    });
    acc = {};
    events = [];
    taps = 0;
    segStart = now();
    var sent = false;
    try {
      sent = navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
    } catch (e) { sent = false; }
    if (!sent) {
      try { fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) { /* drop */ }
    }
  }

  function setScreen(name) {
    name = clean(name, 24).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    if (!name || name === screen) return;
    bank();
    screen = name;
    screenSince = now();
  }

  function onTap(e) {
    var el = e.target && e.target.closest && e.target.closest("button,a,[role=button],[role=tab],[role=switch],summary,[data-pm]");
    if (!el) return;
    taps += 1;
    var namedEl = el.closest("[data-pm]");
    var named = namedEl ? namedEl.getAttribute("data-pm") : "";
    var priv = PRIVATE_SCREENS[screen] || el.closest("[data-pm-private]");
    if (priv) { push(named ? "tap:" + named : "tap", ""); return; }
    var label = el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "";
    push("tap", named || label);
  }

  function markInput() {
    var t = now();
    if (t - lastInput >= IDLE_MS) { bank(); screenSince = t; }
    lastInput = t;
  }

  document.addEventListener("click", onTap, true);
  ["pointerdown", "keydown", "wheel", "touchmove"].forEach(function (ev) {
    document.addEventListener(ev, markInput, { capture: true, passive: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      bank();
      visible = false;
      flush();
    } else {
      visible = true;
      lastInput = now();
      screenSince = now();
    }
  });
  window.addEventListener("pagehide", function () { if (visible) { bank(); flush(); } });
  setInterval(function () { if (visible) flush(); }, FLUSH_EVERY_MS);

  window.pmTrack = {
    enabled: true,
    screen: setScreen,
    event: function (name, detail) { push(name, detail); }
  };
  if (newSession) push("session_start", from ? "from " + from : "");
  if (/^\/(tonal|portal)/.test(location.pathname)) setScreen("agon");
  else if (/^\/studies/.test(location.pathname)) setScreen("mouseion");
  pending.forEach(function (c) {
    if (c[0] === "screen") setScreen(c[1]);
    else push(c[1], c[2]);
  });
})();

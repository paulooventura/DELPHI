/* Agon enrollment + public directory.
 * Depends on portal globals: esc, modal, closeModal, toast, outbound.
 * Roles/certs come from window.AGON_ROLES / window.AGON_CERTS (set in ensureTonal).
 * Never ask for SSN, W-9, tax IDs, or bank details here. */
(function () {
  "use strict";

  var KINDS = [
    { id: "venue", ico: "🏛️", label: "Venue", lede: "Offer your room to the scene — capacity, what's already installed, and when you're open." },
    { id: "investor", ico: "💎", label: "Backer", lede: "Sponsor something you want to see happen — as yourself, an alias, a philanthropist, or anonymously. No money talk here; we start with the endeavor." },
    { id: "promoter", ico: "🎫", label: "Promoter", lede: "Bring an endeavor into the pool — the night you want to build and the crew it needs." },
    { id: "role", ico: "🧩", label: "Crew / role", lede: "Put your name down for a role on the crew — paid, or volunteer / work-exchange." }
  ];
  var PRESENCE = [
    { id: "person", ico: "🙂", label: "Myself", name: "Your name" },
    { id: "alias", ico: "🎭", label: "An alias", name: "Alias" },
    { id: "philanthropist", ico: "🌱", label: "Philanthropist", name: "Name or foundation" },
    { id: "anonymous", ico: "🕶️", label: "Anonymous", name: "" }
  ];
  var VENUE_TYPES = ["Bar / lounge", "Club", "Warehouse / loft", "Concert hall", "Outdoor site", "Gallery / studio", "Other"];
  var TIERS = ["Bar ≤150", "Club night", "Concert", "Festival 5k+"];
  var FIELD_LABELS = {
    display_name: "Name", contact_email: "Email", city: "City", link: "Link",
    consent: "Consent", capacity: "Capacity", sponsor: "What you'd sponsor", role: "Role", kind: "Type"
  };

  var st = null;

  function plain(s) {
    return String(s == null ? "" : s).replace(/&amp;/g, "&");
  }
  function attr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }
  function kindOf(id) {
    return KINDS.filter(function (k) { return k.id === id; })[0] || KINDS[0];
  }
  function presenceOf(id) {
    return PRESENCE.filter(function (p) { return p.id === id; })[0] || PRESENCE[0];
  }

  function field(name, label, opts) {
    opts = opts || {};
    var v = st.v[name] == null ? "" : st.v[name];
    var req = opts.req ? ' <b class="enreq">*</b>' : "";
    var input;
    if (opts.options) {
      input = '<select class="wzin" data-f="' + name + '"><option value="">Choose…</option>' +
        opts.options.map(function (o) {
          var val = typeof o === "string" ? o : o.v;
          var lab = typeof o === "string" ? o : o.l;
          return '<option value="' + attr(val) + '"' + (val === v ? " selected" : "") + ">" + esc(lab) + "</option>";
        }).join("") + "</select>";
    } else if (opts.area) {
      input = '<textarea class="wzin enarea" data-f="' + name + '" maxlength="' + (opts.max || 800) + '" placeholder="' + attr(opts.ph || "") + '">' + esc(v) + "</textarea>";
    } else {
      input = '<input class="wzin" data-f="' + name + '" type="' + (opts.type || "text") + '" maxlength="' + (opts.max || 120) + '" value="' + attr(v) + '" placeholder="' + attr(opts.ph || "") + '"' + (opts.auto ? ' autocomplete="' + opts.auto + '"' : "") + ">";
    }
    return '<label class="wzf"><span>' + esc(label) + req + "</span>" + input + "</label>";
  }

  function roleFields() {
    var roles = window.AGON_ROLES;
    var certs = window.AGON_CERTS || {};
    var depts = roles && roles.depts ? roles.depts : [];
    var dept = depts.filter(function (d) { return d.id === st.v.dept; })[0];
    var html = "";
    html += field("dept", "Department", { options: depts.map(function (d) { return { v: d.id, l: d.ico + " " + plain(d.name) }; }) });
    var roleOpts = (dept ? dept.roles : []).map(function (r) { return plain(r.n); });
    if (dept) html += field("role", "Role", { req: true, options: roleOpts });
    else html += field("role", "Role", { req: true, ph: "Pick a department, or type the role you want" });
    html += '<label class="enck"><input type="checkbox" data-f="volunteer"' + (st.v.volunteer ? " checked" : "") + '> <span>Volunteer / work-exchange — trade a shift for your way in</span></label>';
    var certKeys = Object.keys(certs);
    if (certKeys.length) {
      var have = st.v.certs || [];
      html += '<div class="wzf"><span>Certifications you hold</span><div class="encerts">' +
        certKeys.map(function (k) {
          return '<label class="encert"><input type="checkbox" data-cert="' + attr(k) + '"' + (have.indexOf(k) >= 0 ? " checked" : "") + "> " + esc(certs[k]) + "</label>";
        }).join("") + "</div></div>";
    }
    html += field("availability", "Availability", { ph: "Weekends, Thursdays, festival season…", max: 240 });
    html += field("experience", "Experience", { area: true, ph: "Past shows, rooms, rigs — whatever shows you're ready." });
    return html;
  }

  function kindFields() {
    if (st.kind === "venue") {
      return field("venue_type", "Type of room", { options: VENUE_TYPES }) +
        field("capacity", "Capacity", { req: true, ph: "~300", max: 20 }) +
        field("infrastructure", "What's installed", { ph: "PA, lights, bar, green room, power…", max: 240 }) +
        field("open_dates", "Dates you're open", { ph: "Weeknights, Sundays, Q1…", max: 240 });
    }
    if (st.kind === "investor") {
      return field("sponsor", "What you'd like to sponsor", { ph: "A warehouse night, a festival, a crew, youth music, a cause…", max: 240 }) +
        '<div class="pmguard">🛡️ This is an introduction, not an offer. Nothing is sold, signed, or paid here — we talk about the endeavor first. Not financial advice.</div>';
    }
    if (st.kind === "promoter") {
      return field("event_name", "Endeavor name", { ph: "Coupled // Warehouse" }) +
        field("event_date", "Date", { ph: "Sat, Mar 14 — or 'Every Thursday'" }) +
        field("event_venue", "Venue / location", { ph: "The Annex, Nashville" }) +
        field("tier", "Scale", { options: TIERS }) +
        field("style", "Style / intention", { ph: "Deep house, high-warmth, care-first" }) +
        field("cap", "Expected capacity", { ph: "~450", max: 20 });
    }
    return roleFields();
  }

  function render() {
    var k = kindOf(st.kind);
    var tabs = KINDS.map(function (x) {
      return '<button type="button" class="enkind' + (x.id === st.kind ? " on" : "") + '" data-kind="' + x.id + '"><span>' + x.ico + "</span>" + esc(x.label) + "</button>";
    }).join("");
    var err = st.error ? '<div class="enerr">' + esc(st.error) + "</div>" : "";
    var backer = st.kind === "investor";
    var pres = presenceOf(st.v.presence);
    var anon = backer && pres.id === "anonymous";
    var presence = backer
      ? '<div class="wzf"><span>How would you like to appear?</span><div class="enpres">' +
        PRESENCE.map(function (x) {
          return '<button type="button" class="enkind' + (x.id === pres.id ? " on" : "") + '" data-presence="' + x.id + '"><span>' + x.ico + "</span>" + esc(x.label) + "</button>";
        }).join("") + "</div></div>" +
        (anon ? '<p class="ennote">You\'ll show as “Anonymous backer”. Only Paulo sees your email.</p>' : "")
      : "";
    var nameLabel = st.kind === "venue" ? "Venue name" : backer ? pres.name : "Name (as it should appear)";
    var consentText = anon
      ? "I agree to be contacted about Agon. If approved, I appear only as “Anonymous backer” with what I'd sponsor and my note. Email and phone stay private."
      : "I agree to be contacted about Agon. If approved, my name, city, headline, about, and link can appear in the public directory. Email and phone stay private.";
    modal(
      '<form class="wzwrap enform" novalidate>' +
        '<p class="pmkick">✦ Enroll in Agon</p>' +
        '<div class="enkinds">' + tabs + "</div>" +
        '<p class="wzsub">' + esc(k.lede) + "</p>" +
        presence +
        (anon ? "" : field("display_name", nameLabel, { req: true, auto: st.kind === "venue" || pres.id === "philanthropist" ? "organization" : pres.id === "alias" ? "off" : "name" })) +
        (anon ? "" : field("city", "City", { req: true, ph: "Nashville, TN", auto: "address-level2" })) +
        kindFields() +
        field("about", anon ? "A note (optional)" : "About", { area: true, ph: anon ? "Why this matters to you — no names needed." : "A few lines on who you are and what you bring." }) +
        (anon ? "" : field("link", "Link", { ph: "Website, Instagram @handle, SoundCloud…", max: 240, auto: "url" })) +
        '<p class="enprivate">Private — only Paulo sees these</p>' +
        field("contact_email", "Email", { req: true, type: "email", auto: "email", max: 254 }) +
        (backer && pres.id !== "person" ? field("private_name", "Your real name (optional)", { auto: "name" }) : "") +
        field("phone", "Phone (optional)", { type: "tel", auto: "tel", max: 40 }) +
        '<label class="enhp" aria-hidden="true">Website <input tabindex="-1" autocomplete="off" data-f="website"></label>' +
        '<label class="enck"><input type="checkbox" data-f="consent"' + (st.v.consent ? " checked" : "") + "> <span>" + esc(consentText) + "</span></label>" +
        '<p class="enfoot">Never send SSN, W-9, or bank details here — payment platforms handle that when a booking is real.</p>' +
        err +
        '<div class="wznav"><button type="button" class="evbtn" data-act="cancel">Cancel</button><button type="submit" class="evbtn primary"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "Sending…" : "✦ Submit for review") + "</button></div>" +
      "</form>"
    );
    bind();
  }

  function collect(form) {
    form.querySelectorAll("[data-f]").forEach(function (el) {
      var f = el.getAttribute("data-f");
      st.v[f] = el.type === "checkbox" ? el.checked : el.value;
    });
    var certs = [];
    form.querySelectorAll("[data-cert]").forEach(function (el) {
      if (el.checked) certs.push(el.getAttribute("data-cert"));
    });
    st.v.certs = certs;
  }

  function bind() {
    var form = document.querySelector("#modalHost .enform");
    if (!form) return;
    form.querySelectorAll("[data-kind]").forEach(function (b) {
      b.onclick = function () {
        collect(form);
        st.kind = b.getAttribute("data-kind");
        st.error = "";
        render();
      };
    });
    form.querySelectorAll("[data-presence]").forEach(function (b) {
      b.onclick = function () {
        collect(form);
        st.v.presence = b.getAttribute("data-presence");
        st.error = "";
        render();
      };
    });
    var dept = form.querySelector('[data-f="dept"]');
    if (dept) dept.onchange = function () { collect(form); st.v.role = ""; render(); };
    form.querySelector('[data-act="cancel"]').onclick = function () { closeModal(); };
    form.onsubmit = function (ev) {
      ev.preventDefault();
      collect(form);
      submit();
    };
  }

  function submit() {
    if (st.busy) return;
    var v = st.v;
    var missing = [];
    var anon = st.kind === "investor" && v.presence === "anonymous";
    if (!anon && !String(v.display_name || "").trim()) missing.push("name");
    if (!anon && !String(v.city || "").trim()) missing.push("city");
    if (!/^\S+@\S+\.\S+$/.test(String(v.contact_email || "").trim())) missing.push("a valid email");
    if (!v.consent) missing.push("the consent box");
    if (st.kind === "venue" && !String(v.capacity || "").trim()) missing.push("capacity");
    if (st.kind === "role" && !String(v.role || "").trim()) missing.push("a role");
    if (missing.length) {
      st.error = "Still needed: " + missing.join(", ") + ".";
      render();
      return;
    }

    var payload = { kind: st.kind, started_at: st.startedAt, source: st.source };
    Object.keys(v).forEach(function (k) { payload[k] = v[k]; });
    if (st.kind === "investor") {
      payload.presence = presenceOf(v.presence).id;
      if (anon) { payload.display_name = ""; payload.city = ""; payload.link = ""; }
    }
    if (st.kind === "role" && v.dept) {
      var d = (window.AGON_ROLES && window.AGON_ROLES.depts || []).filter(function (x) { return x.id === v.dept; })[0];
      if (d) payload.dept = plain(d.name);
    }

    st.busy = true;
    st.error = "";
    render();
    fetch("/api/agon/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        st.busy = false;
        if (res.status === 200 && res.body.ok) return done();
        if (res.status === 503) st.error = "Enrollment isn't connected yet — the sheet goes live shortly. Your answers are still here; try again soon.";
        else if (res.status === 429) st.error = "Too many sends from this connection. Give it a few minutes.";
        else if (res.body && res.body.fields) st.error = "Check: " + res.body.fields.map(function (f) { return FIELD_LABELS[f] || f; }).join(", ") + ".";
        else st.error = "Couldn't reach the sheet. Try again in a moment.";
        render();
      })
      .catch(function () {
        st.busy = false;
        st.error = "Network hiccup. Try again in a moment.";
        render();
      });
  }

  function done() {
    var k = kindOf(st.kind);
    modal(
      '<div class="pmwrap" style="text-align:center">' +
        '<div style="font-size:30px;margin:6px 0 10px">' + k.ico + "</div>" +
        '<h3 style="margin:0 0 8px;font-family:var(--serif);font-size:20px">You\'re on the list</h3>' +
        '<p class="pmintro">Paulo reviews every enrollment by hand. Once approved, you\'ll appear in the Agon directory and hear back at the email you gave.</p>' +
        '<button class="pmclose" onclick="closeModal()">Close</button>' +
      "</div>"
    );
    toast("✦ Enrollment received");
    if (window.pmTrack) window.pmTrack.event("enroll_sent", st.kind);
    st = null;
    if (window.agonDirectoryRefresh) window.agonDirectoryRefresh();
  }

  /** agonEnroll(kind, prefill) — prefill keys match form fields; `source` tags the entry. */
  window.agonEnroll = function (kind, prefill) {
    prefill = prefill || {};
    st = {
      kind: kindOf(kind).id,
      v: {},
      startedAt: Date.now(),
      source: String(prefill.source || "agon").slice(0, 60),
      busy: false,
      error: ""
    };
    Object.keys(prefill).forEach(function (k) { if (k !== "source") st.v[k] = prefill[k]; });
    if (window.pmTrack) window.pmTrack.event("enroll_open", st.kind + " · " + st.source);
    render();
  };

  /* ---------- public directory (approved only) ---------- */
  var dir = { host: null, entries: null, filter: "all", state: "idle" };

  function dirRender() {
    if (!dir.host) return;
    var chips = [{ id: "all", label: "All" }].concat(KINDS.map(function (k) { return { id: k.id, label: k.ico + " " + k.label }; }))
      .map(function (c) {
        return '<button type="button" class="dirchip' + (dir.filter === c.id ? " on" : "") + '" data-dk="' + c.id + '">' + esc(c.label) + "</button>";
      }).join("");
    var body;
    if (dir.state === "loading") body = '<p class="dirempty">Loading the directory…</p>';
    else if (dir.state === "off") body = '<p class="dirempty">The directory opens once enrollment is connected. Be one of the first — enroll above.</p>';
    else if (dir.state === "error") body = '<p class="dirempty">Couldn\'t load the directory right now.</p>';
    else {
      var list = (dir.entries || []).filter(function (e) { return dir.filter === "all" || e.kind === dir.filter; });
      body = list.length
        ? '<div class="dirgrid">' + list.map(function (e) {
            var k = kindOf(e.kind);
            var link = e.link ? '<button type="button" class="evbtn dirlink" data-url="' + attr(e.link) + '" data-name="' + attr(e.display_name) + '">Visit ↗</button>' : "";
            return '<div class="dircard"><div class="dirtop"><span class="dirico">' + k.ico + '</span><div><h4>' + esc(e.display_name) + '</h4><span class="dirmeta">' + esc(k.label) + (e.city ? " · " + esc(e.city) : "") + "</span></div></div>" +
              (e.headline ? '<p class="dirhead">' + esc(e.headline) + "</p>" : "") +
              (e.about ? '<p class="dirabout">' + esc(e.about) + "</p>" : "") + link + "</div>";
          }).join("") + "</div>"
        : '<p class="dirempty">No approved ' + (dir.filter === "all" ? "entries" : esc(kindOf(dir.filter).label.toLowerCase()) + " entries") + " yet.</p>";
    }
    dir.host.innerHTML = '<div class="dirchips">' + chips + "</div>" + body;
    dir.host.querySelectorAll("[data-dk]").forEach(function (b) {
      b.onclick = function () { dir.filter = b.getAttribute("data-dk"); dirRender(); };
    });
    dir.host.querySelectorAll(".dirlink").forEach(function (b) {
      b.onclick = function () {
        var url = b.getAttribute("data-url");
        if (typeof outbound === "function") outbound(url, b.getAttribute("data-name"));
        else window.open(url, "_blank", "noopener,noreferrer");
      };
    });
  }

  function dirLoad() {
    dir.state = "loading";
    dirRender();
    fetch("/api/agon/directory", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        dir.entries = j.entries || [];
        dir.state = j.configured === false ? "off" : (j.error && !dir.entries.length ? "error" : "ok");
        dirRender();
      })
      .catch(function () { dir.state = "error"; dirRender(); });
  }

  window.agonDirectoryMount = function (host) {
    if (!host) return;
    var fresh = dir.host !== host;
    dir.host = host;
    if (fresh || dir.entries === null) dirLoad();
    else dirRender();
  };
  window.agonDirectoryRefresh = function () { if (dir.host) dirLoad(); };

  var css = document.createElement("style");
  css.textContent = [
    ".enform{padding:22px 22px 18px}",
    ".modal .wzin{background:rgba(8,6,18,.78);border:1px solid rgba(200,185,255,.22);color:#f6f2ff}",
    ".modal .wzin::placeholder{color:rgba(220,210,255,.38)}",
    ".modal select.wzin option{background:#120e1f;color:#f6f2ff}",
    ".enkinds{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 12px}",
    ".enkind{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;opacity:.62}",
    ".enkind span{font-size:18px}.enkind.on{opacity:1;filter:brightness(1.25)}",
    ".enarea{min-height:78px;resize:vertical}",
    ".enpres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
    ".ennote{font-size:12px;color:#cbbcff;margin:-2px 0 10px}",
    "select.wzin{appearance:auto}",
    ".enreq{color:var(--amber);font-weight:700}",
    ".enck{display:flex;gap:10px;align-items:flex-start;margin:10px 0;font-size:12.5px;color:var(--fog);line-height:1.45;cursor:pointer}",
    ".enck input{margin-top:3px;accent-color:#8B6CFF}",
    ".encerts{display:flex;flex-wrap:wrap;gap:6px 14px}",
    ".encert{font-size:12px;color:var(--fog);display:flex;gap:6px;align-items:center;cursor:pointer}.encert input{accent-color:#8B6CFF}",
    ".enprivate{font-family:ui-monospace,monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#b9a6ff;margin:16px 0 8px;border-top:1px solid var(--lsoft);padding-top:12px}",
    ".enhp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}",
    ".enfoot{font-size:11px;color:var(--fogd);margin:6px 0 10px}",
    ".enerr{border:1px solid rgba(255,120,120,.4);background:rgba(255,90,90,.08);color:#ffb3b3;border-radius:10px;padding:10px 12px;font-size:12.5px;margin:8px 0}",
    ".enrollpanel{display:grid;gap:22px}",
    ".dirchips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}",
    ".dirchip{font:inherit;font-size:12px;font-weight:700;padding:7px 13px;cursor:pointer;opacity:.6}.dirchip.on{opacity:1;filter:brightness(1.25)}",
    ".dirgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}",
    ".dircard{border:1px solid rgba(220,210,255,.2);border-radius:14px;padding:16px;background:radial-gradient(140% 120% at 20% 0%,rgba(255,255,255,.1),transparent 55%),linear-gradient(180deg,hsla(272,42%,30%,.5),hsla(268,24%,8%,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 9px 22px rgba(0,0,0,.34);display:flex;flex-direction:column;gap:8px;color:#f6f2ff}",
    ".dirtop{display:flex;gap:10px;align-items:center}.dirico{font-size:22px}",
    ".dircard h4{margin:0;font-size:15px;font-weight:750}",
    ".dirmeta{font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--fogd)}",
    ".dirhead{margin:0;color:#cbbcff;font-size:12.5px;font-weight:650}",
    ".dirabout{margin:0;color:var(--fog);font-size:12.5px;line-height:1.5}",
    ".dirlink{align-self:flex-start;margin-top:auto}",
    ".dirempty{color:var(--fog);font-size:13px}",
    "@media (max-width:520px){.enkinds,.enpres{grid-template-columns:repeat(2,1fr)}}"
  ].join("\n");
  document.head.appendChild(css);
})();

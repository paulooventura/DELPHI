/* Agon enrollment + public directory.
 * Depends on portal globals: esc, modal, closeModal, toast, outbound.
 * Departments/roles come from window.AGON_ROLES (set in ensureTonal); certifications, venue gear,
 * backer visions and the availability grid come from /agon-catalog.json (also read by the server).
 * Never ask for SSN, W-9, tax IDs, or bank details here. */
(function () {
  "use strict";

  var KINDS = [
    { id: "venue", ico: "🏛️", label: "Venue", lede: "Offer your room to the scene: capacity, the gear and services you already have, and when you're open." },
    { id: "promoter", ico: "🎫", label: "Promoter", lede: "Your company, and how to reach you. The nights themselves come later, together." },
    { id: "investor", ico: "💎", label: "Backer", lede: "Back something you want to see happen, as yourself, an alias, a philanthropist, or anonymously. No money talk here; we start with the vision." },
    { id: "role", ico: "🧩", label: "Crew", lede: "Put your name down for the crew. Pick every department and role you can work; paid, or volunteer / work-exchange." }
  ];
  var PRESENCE = [
    { id: "person", ico: "🙂", label: "Myself", name: "Your name" },
    { id: "alias", ico: "🎭", label: "An alias", name: "Alias" },
    { id: "philanthropist", ico: "🌱", label: "Philanthropist", name: "Name or foundation" },
    { id: "anonymous", ico: "🕶️", label: "Anonymous", name: "A name we can call you (it can be invented)" }
  ];
  var VENUE_TYPES = ["Bar / lounge", "Club", "Warehouse / loft", "Concert hall", "Outdoor site", "Gallery / studio", "Other"];
  var FIELD_LABELS = {
    display_name: "Name", contact_email: "Email", phone: "Phone", city: "City", link: "Link",
    consent: "Consent", capacity: "Capacity", role: "Role", kind: "Type", cert_other: "the other certification's name"
  };
  var PRIVACY_LINE = "Stored securely by Pneuma's platform. Used to review your enrollment and to connect you for work. Never shown publicly or sold.";
  /* Under Vercel's 4.5 MB request cap; big photos are shrunk on the phone first. */
  var MAX_FILE = 4 * 1024 * 1024;
  var MAX_TOTAL = Math.floor(4.3 * 1024 * 1024);

  var st = null;
  var CAT = null;
  var catLoad = null;
  function loadCatalog() {
    if (CAT) return Promise.resolve(CAT);
    if (!catLoad) {
      catLoad = fetch("/agon-catalog.json", { cache: "force-cache" })
        .then(function (r) { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); })
        .then(function (j) { CAT = j; return j; })
        .catch(function (e) { catLoad = null; throw e; });
    }
    return catLoad;
  }
  loadCatalog().catch(function () { /* retried when the form opens */ });

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
  function arr(name) {
    if (!Array.isArray(st.v[name])) st.v[name] = st.v[name] ? [st.v[name]] : [];
    return st.v[name];
  }
  function has(name, val) { return arr(name).indexOf(val) >= 0; }
  function allCerts() {
    return (CAT ? CAT.certs : []).reduce(function (a, g) { return a.concat(g.items); }, []);
  }
  function certLabel(id) {
    var c = allCerts().filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

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
      input = '<input class="wzin" data-f="' + name + '" type="' + (opts.type || "text") + '" maxlength="' + (opts.max || 120) + '" value="' + attr(v) + '" placeholder="' + attr(opts.ph || "") + '"' + (opts.auto ? ' autocomplete="' + opts.auto + '"' : "") + (opts.mode ? ' inputmode="' + opts.mode + '"' : "") + ">";
    }
    return '<label class="wzf"><span>' + esc(label) + req + "</span>" + input + (opts.hint ? '<em class="enhint">' + esc(opts.hint) + "</em>" : "") + "</label>";
  }

  /** Multi-select chips. `redraw` re-renders the form when the choice changes what's shown below. */
  function chips(name, items, redraw) {
    return '<div class="enchips">' + items.map(function (it) {
      var on = has(name, it.id);
      return '<button type="button" class="enchip' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-multi="' + name + '" data-val="' + attr(it.id) + '"' + (redraw ? ' data-redraw="1"' : "") + ">" + esc(it.label) + "</button>";
    }).join("") + "</div>";
  }
  function groupedChips(name, groups, redraw) {
    return groups.map(function (g) {
      return '<div class="engroup"><p class="engrouphead">' + esc(g.group) + "</p>" + chips(name, g.items, redraw) + "</div>";
    }).join("");
  }
  function section(title, inner, note) {
    return '<div class="ensec"><p class="ensechead">' + esc(title) + "</p>" + (note ? '<p class="ennote">' + esc(note) + "</p>" : "") + inner + "</div>";
  }

  function availabilityGrid() {
    var a = CAT.availability;
    var head = "<tr><th></th>" + a.slots.map(function (s) { return '<th scope="col">' + esc(s.label) + "<small>" + esc(s.hint) + "</small></th>"; }).join("") + "</tr>";
    var rows = a.days.map(function (d) {
      return '<tr><th scope="row">' + esc(d.label) + "</th>" + a.slots.map(function (s) {
        var key = d.id + "-" + s.id;
        var on = has("slots", key);
        return '<td><button type="button" class="enslot' + (on ? " on" : "") + '" aria-pressed="' + on + '" aria-label="' + attr(d.label + " " + s.label) + '" data-multi="slots" data-val="' + key + '">' + (on ? "✓" : "") + "</button></td>";
      }).join("") + "</tr>";
    }).join("");
    return '<table class="engrid"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table>" +
      '<div class="enrow2">' +
      field("notice", "Notice you need", { options: a.notice.map(function (n) { return { v: n.id, l: n.label }; }) }) +
      field("radius", "How far you'll travel", { options: a.radius.map(function (n) { return { v: n.id, l: n.label }; }) }) +
      "</div>" +
      field("blackout", "Dates you can't (optional)", { ph: "Dec 20 – Jan 2, every 1st Sunday…", max: 240 });
  }

  function certRows() {
    var picked = arr("certs");
    if (!picked.length) return "";
    return '<div class="encertfiles">' + picked.map(function (id) {
      var f = st.files[id];
      var status = f ? '<span class="enfileok">✓ ' + esc(f.name) + " · " + kb(f.size) + "</span>" : '<span class="enfilemiss">Upload required</span>';
      var other = id === "other" ? field("cert_other", "Which certification?", { req: true, ph: "Name of the certification", max: 120 }) : "";
      return '<div class="encertrow">' + other +
        '<div class="encertline"><span class="encertname">' + esc(id === "other" ? (st.v.cert_other || "Other") : certLabel(id)) + "</span>" + status +
        '<label class="evbtn enfilebtn">' + (f ? "Change" : "Add file") + '<input type="file" accept=".pdf,image/*" data-certfile="' + attr(id) + '"></label></div></div>';
    }).join("") + '<p class="enhint">A photo or PDF of each certificate, up to 4 MB each. Big photos are shrunk on your phone before sending.</p></div>';
  }

  function roleFields() {
    var depts = (window.AGON_ROLES && window.AGON_ROLES.depts) || [];
    var deptItems = depts.map(function (d) { return { id: d.id, label: d.ico + " " + plain(d.name) }; });
    var picked = depts.filter(function (d) { return has("depts", d.id); });
    var roleBlock = picked.length
      ? picked.map(function (d) {
          return '<div class="engroup"><p class="engrouphead">' + esc(d.ico + " " + plain(d.name)) + "</p>" +
            chips("roles", d.roles.map(function (r) { return { id: plain(r.n), label: plain(r.n) }; })) + "</div>";
        }).join("")
      : '<p class="ennote">Pick one or more departments above and their roles show here.</p>';
    return section("What you do",
        '<div class="wzf"><span>Departments <b class="enreq">*</b></span>' + chips("depts", deptItems, true) + "</div>" +
        '<div class="wzf"><span>Roles <b class="enreq">*</b></span>' + roleBlock + "</div>" +
        '<label class="enck"><input type="checkbox" data-f="volunteer"' + (st.v.volunteer ? " checked" : "") + "> <span>Volunteer / work-exchange: trade a shift for your way in</span></label>",
        "Choose as many as you can work. Security who also DJs, a bartender who runs lights: pick them all.") +
      section("Certifications", groupedChips("certs", CAT.certs, true) + certRows(), "Tap each one you hold. Every certification needs its file.") +
      section("Availability", availabilityGrid(), "Tap the times you can usually work.");
  }

  function kindFields() {
    if (st.kind === "venue") {
      return section("The room",
          '<div class="enrow2">' + field("venue_type", "Type of room", { options: VENUE_TYPES }) +
          field("capacity", "Capacity", { req: true, ph: "~300", max: 20, mode: "numeric" }) + "</div>" +
          field("open_dates", "Dates you're open", { ph: "Weeknights, Sundays, Q1…", max: 240 })) +
        section("Gear & services you have", groupedChips("gear", CAT.gear) +
          field("gear_other", "Anything else", { ph: "Fire pit, rooftop, sauna…", max: 240 }), "Tick everything the room already has, so promoters and backers can plan around it.");
    }
    if (st.kind === "investor") {
      return section("What's your vision?", chips("vision", CAT.vision) +
          field("vision_text", "In a line (optional)", { ph: "A warehouse night for local DJs, a youth music program…", max: 240 })) +
        '<div class="pmguard">🛡️ This is an introduction, not an offer. Nothing is sold, signed, or paid here. We talk about the vision first. Not financial advice.</div>';
    }
    if (st.kind === "promoter") return "";
    return roleFields();
  }

  function nameLabel(pres) {
    if (st.kind === "venue") return "Venue name";
    if (st.kind === "promoter") return "Company name";
    if (st.kind === "investor") return pres.name;
    return "Your name";
  }

  function render() {
    var host = document.querySelector("#modalHost .enbody");
    var keepScroll = host && st.keepScroll ? host.scrollTop : 0;
    st.keepScroll = false;
    var k = kindOf(st.kind);
    var tabs = KINDS.map(function (x) {
      return '<button type="button" class="enkind' + (x.id === st.kind ? " on" : "") + '" data-kind="' + x.id + '"><span>' + x.ico + "</span>" + esc(x.label) + "</button>";
    }).join("");
    var err = st.error ? '<div class="enerr" role="alert">' + esc(st.error) + "</div>" : "";
    var backer = st.kind === "investor";
    var pres = presenceOf(st.v.presence);
    var anon = backer && pres.id === "anonymous";
    var presence = backer
      ? '<div class="wzf"><span>How would you like to appear?</span><div class="enpres">' +
        PRESENCE.map(function (x) {
          return '<button type="button" class="enkind' + (x.id === pres.id ? " on" : "") + '" data-presence="' + x.id + '"><span>' + x.ico + "</span>" + esc(x.label) + "</button>";
        }).join("") + "</div></div>" +
        (anon ? '<p class="ennote">You\'ll show as “Anonymous backer”. We still need a name to call you and a way to reach you, for when a night gets planned.</p>' : "")
      : "";
    var consentText = anon
      ? "I agree to be contacted about Agon. If approved, I appear only as “Anonymous backer” with my vision and note. My name, email and phone stay private."
      : "I agree to be contacted about Agon. If approved, my name, city, headline, about, and link can appear in the public directory. Email and phone stay private.";
    modal(
      '<form class="wzwrap enform" novalidate>' +
        '<div class="enhead"><p class="pmkick">✦ Enroll in Agon</p><div class="enkinds">' + tabs + "</div></div>" +
        '<div class="enbody">' +
          '<p class="wzsub">' + esc(k.lede) + "</p>" +
          presence +
          field("display_name", nameLabel(pres), { req: true, auto: st.kind === "venue" || st.kind === "promoter" || pres.id === "philanthropist" ? "organization" : pres.id === "person" ? "name" : "off" }) +
          '<div class="enrow2">' + field("city", anon ? "City (optional)" : "City", { req: !anon, ph: "Nashville, TN", auto: "address-level2" }) +
          (anon ? "" : field("link", "Link (optional)", { ph: "Website, Instagram @handle…", max: 240, auto: "url" })) + "</div>" +
          kindFields() +
          field("about", anon ? "A note (optional)" : "About", { area: true, ph: anon ? "Why this matters to you. No names needed." : st.kind === "role" ? "Who you are, past shows, rooms and rigs: whatever shows you're ready." : "A few lines on who you are and what you bring." }) +
          section("Contact",
            '<div class="enrow2">' + field("contact_email", "Email", { req: true, type: "email", auto: "email", max: 254 }) +
            field("phone", "Phone", { req: true, type: "tel", auto: "tel", max: 40 }) + "</div>" +
            (backer && pres.id !== "person" && !anon ? field("private_name", "Your real name (optional)", { auto: "name" }) : ""),
            PRIVACY_LINE) +
          '<label class="enhp" aria-hidden="true">Website <input tabindex="-1" autocomplete="off" data-f="website"></label>' +
          '<label class="enck"><input type="checkbox" data-f="consent"' + (st.v.consent ? " checked" : "") + "> <span>" + esc(consentText) + "</span></label>" +
          '<p class="enfoot">Never send SSN, W-9, or bank details here. Payment platforms handle that when a booking is real.</p>' +
        "</div>" +
        '<div class="enfootbar">' + err +
          '<div class="wznav"><button type="button" class="evbtn" data-act="cancel">Cancel</button><button type="submit" class="evbtn primary"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? (st.busyText || "Sending…") : "✦ Submit for review") + "</button></div>" +
        "</div>" +
      "</form>"
    );
    var body = document.querySelector("#modalHost .enbody");
    if (body && keepScroll) body.scrollTop = keepScroll;
    bind();
  }

  function collect(form) {
    form.querySelectorAll("[data-f]").forEach(function (el) {
      var f = el.getAttribute("data-f");
      st.v[f] = el.type === "checkbox" ? el.checked : el.value;
    });
  }

  var DRAFT_KEY = "pm-enroll-draft";
  var NOT_TYPED = { consent: 1, presence: 1, volunteer: 1, website: 1 };

  function saveDraft() {
    if (!st) return;
    try {
      var v = {};
      Object.keys(st.v).forEach(function (k) { if (k !== "website") v[k] = st.v[k]; });
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ kind: st.kind, v: v }));
    } catch (e) { /* private mode */ }
  }
  function loadDraft() {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; }
  }
  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* private mode */ }
  }
  function typedSomething() {
    if (!st) return false;
    if (Object.keys(st.files).length) return true;
    return Object.keys(st.v).some(function (k) {
      if (NOT_TYPED[k]) return false;
      var v = st.v[k];
      return Array.isArray(v) ? v.length > 0 : String(v == null ? "" : v).trim();
    });
  }

  /** Phone photos are often 3–8 MB: shrink to 2000 px JPEG before sending. PDFs go as they are. */
  function prepFile(file) {
    if (!/^image\//.test(file.type) || file.size < 1.5 * 1048576) return Promise.resolve(file);
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return resolve(file);
          resolve(new File([b], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function bind() {
    var form = document.querySelector("#modalHost .enform");
    if (!form) return;
    var keep = function () { collect(form); saveDraft(); };
    form.addEventListener("input", keep);
    form.addEventListener("change", keep);
    window.pmModalGuard = function () {
      if (!st || st.busy) return !st;
      collect(form);
      if (!typedSomething()) { clearDraft(); return true; }
      if (!window.confirm("Discard what you've typed?")) return false;
      clearDraft();
      st = null;
      return true;
    };
    form.querySelectorAll("[data-kind]").forEach(function (b) {
      b.onclick = function () {
        collect(form);
        st.kind = b.getAttribute("data-kind");
        st.error = "";
        render();
        var body = document.querySelector("#modalHost .enbody");
        if (body) body.scrollTop = 0;
      };
    });
    form.querySelectorAll("[data-presence]").forEach(function (b) {
      b.onclick = function () {
        collect(form);
        st.v.presence = b.getAttribute("data-presence");
        st.error = "";
        st.keepScroll = true;
        render();
      };
    });
    form.querySelectorAll("[data-multi]").forEach(function (b) {
      b.onclick = function () {
        collect(form);
        var name = b.getAttribute("data-multi");
        var val = b.getAttribute("data-val");
        var list = arr(name);
        var i = list.indexOf(val);
        if (i >= 0) list.splice(i, 1); else list.push(val);
        if (name === "certs" && i >= 0) delete st.files[val];
        if (name === "depts" && i >= 0) {
          // Unpicking a department drops its roles too.
          var d = ((window.AGON_ROLES && window.AGON_ROLES.depts) || []).filter(function (x) { return x.id === val; })[0];
          if (d) st.v.roles = arr("roles").filter(function (r) { return !d.roles.some(function (x) { return plain(x.n) === r; }); });
        }
        saveDraft();
        if (b.getAttribute("data-redraw")) { st.keepScroll = true; render(); return; }
        var on = i < 0;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
        if (b.classList.contains("enslot")) b.textContent = on ? "✓" : "";
      };
    });
    form.querySelectorAll("[data-certfile]").forEach(function (inp) {
      inp.onchange = function () {
        var id = inp.getAttribute("data-certfile");
        var f = inp.files && inp.files[0];
        if (!f) return;
        collect(form);
        prepFile(f).then(function (ready) {
          if (!st) return;
          if (ready.size > MAX_FILE) {
            st.error = "That file is " + kb(ready.size) + ". Each certificate can be up to 4 MB: try a photo or a smaller PDF.";
          } else {
            st.files[id] = ready;
            st.error = "";
          }
          st.keepScroll = true;
          render();
        });
      };
    });
    form.querySelector('[data-act="cancel"]').onclick = function () { closeModal(); };
    form.onsubmit = function (ev) {
      ev.preventDefault();
      collect(form);
      submit();
    };
  }

  function showError(msg) {
    st.error = msg;
    st.keepScroll = true;
    render();
  }

  function submit() {
    if (st.busy) return;
    var v = st.v;
    var missing = [];
    var anon = st.kind === "investor" && v.presence === "anonymous";
    var digits = String(v.phone || "").replace(/[\s().\-]/g, "").replace(/^\+/, "");
    if (!String(v.display_name || "").trim()) missing.push("name");
    if (!anon && !String(v.city || "").trim()) missing.push("city");
    if (!/^\S+@\S+\.\S+$/.test(String(v.contact_email || "").trim())) missing.push("a valid email");
    if (!/^\d{7,15}$/.test(digits)) missing.push("a phone number");
    if (!v.consent) missing.push("the consent box");
    if (st.kind === "venue" && !String(v.capacity || "").trim()) missing.push("capacity");
    if (st.kind === "role" && !arr("roles").length) missing.push("at least one role");
    var certs = st.kind === "role" ? arr("certs") : [];
    if (certs.indexOf("other") >= 0 && !String(v.cert_other || "").trim()) missing.push("the other certification's name");
    var noFile = certs.filter(function (c) { return !st.files[c]; });
    if (noFile.length) missing.push("a file for " + noFile.map(certLabel).join(", "));
    if (missing.length) return showError("Still needed: " + missing.join(", ") + ".");
    var total = certs.reduce(function (n, c) { return n + st.files[c].size; }, 0);
    if (total > MAX_TOTAL) return showError("The certificate files add up to " + kb(total) + "; the limit is about 4 MB in all. Swap a PDF for a photo, or send the biggest one later.");

    var payload = { kind: st.kind, started_at: st.startedAt, source: st.source };
    Object.keys(v).forEach(function (k) { payload[k] = v[k]; });
    if (st.kind !== "role") { delete payload.certs; delete payload.slots; delete payload.depts; delete payload.roles; }
    if (st.kind === "investor") {
      payload.presence = presenceOf(v.presence).id;
      if (anon) { payload.link = ""; }
    }
    if (st.kind === "role") {
      var depts = (window.AGON_ROLES && window.AGON_ROLES.depts) || [];
      payload.depts = arr("depts").map(function (id) {
        var d = depts.filter(function (x) { return x.id === id; })[0];
        return d ? plain(d.name) : id;
      });
    }

    var init = { method: "POST" };
    if (certs.length) {
      var fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      certs.forEach(function (c) { fd.append("cert:" + c, st.files[c], st.files[c].name); });
      init.body = fd;
      st.busyText = "Sending files…";
    } else {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(payload);
      st.busyText = "Sending…";
    }

    st.busy = true;
    st.error = "";
    st.keepScroll = true;
    render();
    fetch((window.PM_API_BASE || "") + "/api/agon/enroll", init)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        st.busy = false;
        var b = res.body || {};
        if (res.status === 200 && b.ok) return done(b.approved);
        if (res.status === 503 && b.error === "uploads-off") st.error = "Certificate uploads open once the platform's storage is connected, very soon. Your answers are still here; try again shortly.";
        else if (res.status === 503) st.error = "Enrollment isn't connected yet. It goes live shortly. Your answers are still here; try again soon.";
        else if (res.status === 413) st.error = "The files are too big to send together. Try smaller photos.";
        else if (res.status === 429) st.error = "Too many sends from this connection. Give it a few minutes.";
        else if (b.error === "files") st.error = b.tooBig ? "The files are too big together (about 4 MB in all)." : "Check the file for: " + (b.missing || []).concat((b.problems || []).map(function (p) { return p.cert; })).map(certLabel).join(", ") + " (PDF or photo, up to 4 MB).";
        else if (b.fields) st.error = "Check: " + b.fields.map(function (f) { return FIELD_LABELS[f] || f; }).join(", ") + ".";
        else st.error = "Couldn't send it. Try again in a moment.";
        st.keepScroll = true;
        render();
      })
      .catch(function () {
        st.busy = false;
        st.error = navigator.onLine === false
          ? "Sending needs a connection. Your answers are kept here until you're back online."
          : "Network hiccup. Try again in a moment.";
        st.keepScroll = true;
        render();
      });
  }

  function done(approved) {
    var k = kindOf(st.kind);
    modal(
      '<div class="pmwrap" style="text-align:center">' +
        '<div style="font-size:30px;margin:6px 0 10px">' + k.ico + "</div>" +
        '<h3 style="margin:0 0 8px;font-family:var(--serif);font-size:20px">' + (approved ? "You're in the directory" : "You're on the list") + "</h3>" +
        '<p class="pmintro">' + (approved
          ? "Every check passed, so you're listed in the Agon directory now. We'll be in touch at the email you gave."
          : "Your enrollment gets a quick automatic check, then a final review. Once approved, you'll appear in the Agon directory and hear back at the email you gave.") + "</p>" +
        '<button class="pmclose" onclick="closeModal()">Close</button>' +
      "</div>"
    );
    toast("✦ Enrollment received");
    if (window.pmTrack) window.pmTrack.event("enroll_sent", st.kind);
    clearDraft();
    st = null;
    if (window.agonDirectoryRefresh) window.agonDirectoryRefresh();
  }

  function open() {
    loadCatalog().then(function () { if (st) render(); }, function () {
      if (!st) return;
      modal('<div class="pmwrap" style="text-align:center"><p class="pmintro">The enrollment form needs a connection to open.</p><button class="pmclose" onclick="agonEnroll()">Try again</button> <button class="pmclose" onclick="closeModal()">Close</button></div>');
    });
    if (!CAT) modal('<div class="pmwrap" style="text-align:center"><p class="pmintro">Opening the form…</p></div>');
  }

  /** agonEnroll(kind, prefill) — prefill keys match form fields; `source` tags the entry. */
  window.agonEnroll = function (kind, prefill) {
    prefill = prefill || {};
    st = {
      kind: kindOf(kind).id,
      v: {},
      files: {},
      startedAt: Date.now(),
      source: String(prefill.source || "agon").slice(0, 60),
      busy: false,
      error: ""
    };
    var draft = loadDraft();
    if (draft && draft.v) {
      Object.keys(draft.v).forEach(function (k) { st.v[k] = draft.v[k]; });
      if (!kind && draft.kind) st.kind = kindOf(draft.kind).id;
    }
    // Role cards pass one department and role; the form keeps lists.
    if (prefill.dept) { st.v.depts = arr("depts").concat(arr("depts").indexOf(prefill.dept) < 0 ? [prefill.dept] : []); }
    if (prefill.role) { st.v.roles = arr("roles").concat(arr("roles").indexOf(prefill.role) < 0 ? [prefill.role] : []); }
    Object.keys(prefill).forEach(function (k) { if (k !== "source" && k !== "dept" && k !== "role") st.v[k] = prefill[k]; });
    if (window.pmTrack) window.pmTrack.event("enroll_open", st.kind + " · " + st.source);
    open();
  };

  /* ---------- public directory (approved only) ---------- */
  var dir = { host: null, entries: null, filter: "all", state: "idle" };

  /* Report opens a mail draft (nothing is sent unless the person sends it); Hide keeps a listing off this device. */
  var REPORT_TO = "delphi@pauloventura.org";
  var HIDDEN_KEY = "agon-hidden-v1";
  function hiddenIds() {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]") || []; } catch (e) { return []; }
  }
  function hideId(id) {
    var h = hiddenIds();
    if (h.indexOf(id) < 0) h.push(id);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(h.slice(-500))); } catch (e) { /* private mode */ }
  }
  function reportHref(e) {
    var subject = "Report Agon listing: " + e.display_name + " (" + e.id + ")";
    var body = "Listing: " + e.display_name + " (" + e.id + ")\n\nWhat's wrong with it:\n\n";
    return "mailto:" + REPORT_TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function dirRender() {
    if (!dir.host) return;
    var chips = [{ id: "all", label: "All" }].concat(KINDS.map(function (k) { return { id: k.id, label: k.ico + " " + k.label }; }))
      .map(function (c) {
        return '<button type="button" class="dirchip' + (dir.filter === c.id ? " on" : "") + '" data-dk="' + c.id + '">' + esc(c.label) + "</button>";
      }).join("");
    var body;
    if (dir.state === "loading") body = '<p class="dirempty">Loading the directory…</p>';
    else if (dir.state === "off") body = '<p class="dirempty">The directory opens once enrollment is connected. Be one of the first — enroll above.</p>';
    else if (dir.state === "error") body = navigator.onLine === false
      ? '<p class="dirempty">The directory needs a connection.</p>'
      : '<p class="dirempty">Couldn\'t load the directory right now.</p>';
    else {
      var hidden = hiddenIds();
      var list = (dir.entries || []).filter(function (e) {
        return (dir.filter === "all" || e.kind === dir.filter) && hidden.indexOf(e.id) < 0;
      });
      body = list.length
        ? '<div class="dirgrid">' + list.map(function (e) {
            var k = kindOf(e.kind);
            var link = e.link ? '<button type="button" class="evbtn dirlink" data-url="' + attr(e.link) + '" data-name="' + attr(e.display_name) + '">Visit ↗</button>' : "";
            return '<div class="dircard"><div class="dirtop"><span class="dirico">' + k.ico + '</span><div><h4>' + esc(e.display_name) + '</h4><span class="dirmeta">' + esc(k.label) + (e.city ? " · " + esc(e.city) : "") + "</span></div></div>" +
              (e.headline ? '<p class="dirhead">' + esc(e.headline) + "</p>" : "") +
              (e.about ? '<p class="dirabout">' + esc(e.about) + "</p>" : "") + link +
              '<p class="dirflag" style="margin:8px 0 0;font-size:12px;opacity:.8">' +
              '<a href="' + attr(reportHref(e)) + '" style="color:inherit;text-decoration:underline">Report this listing</a> · ' +
              '<button type="button" class="dirhide" data-hide="' + attr(e.id) + '" style="all:unset;cursor:pointer;text-decoration:underline">Hide it</button>' +
              "</p></div>";
          }).join("") + "</div>"
        : '<p class="dirempty">No approved ' + (dir.filter === "all" ? "entries" : esc(kindOf(dir.filter).label.toLowerCase()) + " entries") + " yet.</p>";
    }
    dir.host.innerHTML = '<div class="dirchips">' + chips + "</div>" + body;
    dir.host.querySelectorAll("[data-dk]").forEach(function (b) {
      b.onclick = function () { dir.filter = b.getAttribute("data-dk"); dirRender(); };
    });
    dir.host.querySelectorAll("[data-hide]").forEach(function (b) {
      b.onclick = function () { hideId(b.getAttribute("data-hide")); dirRender(); };
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
    fetch((window.PM_API_BASE || "") + "/api/agon/directory", { cache: "no-store" })
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
    /* The form is a sheet: header and buttons stay put, the middle scrolls with a visible bar (crew forms are long). */
    ".modal:has(.enform){display:flex;flex-direction:column;max-height:calc(100dvh - 48px)}",
    ".backdrop:has(.enform){padding:24px 12px;align-items:center}",
    ".enform{display:flex;flex-direction:column;min-height:0;max-height:calc(100dvh - 48px);padding:0;background:rgba(10,8,20,.9)}",
    ".enhead{padding:18px 20px 4px;flex:none}",
    ".enbody{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 20px 12px;scrollbar-width:thin;scrollbar-color:rgba(200,185,255,.55) transparent}",
    ".enbody::-webkit-scrollbar{width:8px}.enbody::-webkit-scrollbar-thumb{background:rgba(200,185,255,.5);border-radius:8px}.enbody::-webkit-scrollbar-track{background:transparent}",
    ".enfootbar{flex:none;padding:10px 20px 16px;border-top:1px solid var(--lsoft);background:linear-gradient(180deg,rgba(10,8,20,.6),rgba(10,8,20,.95))}",
    ".enfootbar .wznav{margin-top:0}",
    ".modal .wzin{background:rgba(8,6,18,.78);border:1px solid rgba(200,185,255,.22);color:#f6f2ff}",
    ".modal .wzin::placeholder{color:rgba(220,210,255,.38)}",
    ".modal select.wzin option{background:#120e1f;color:#f6f2ff}",
    ".enkinds{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 8px}",
    ".enkind{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;opacity:.62}",
    ".enkind span{font-size:18px}.enkind.on{opacity:1;filter:brightness(1.25)}",
    ".enarea{min-height:78px;resize:vertical}",
    ".enpres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
    ".ennote{font-size:12px;color:#cbbcff;margin:-2px 0 10px;line-height:1.45}",
    ".enhint{display:block;font-style:normal;font-size:12px;color:var(--fogd);margin-top:5px}",
    "select.wzin{appearance:auto}",
    ".enreq{color:var(--amber);font-weight:700}",
    ".enrow2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}",
    ".ensec{margin:16px 0 6px;border-top:1px solid var(--lsoft);padding-top:12px}",
    ".ensechead{font-family:var(--font-num);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#b9a6ff;margin:0 0 8px}",
    ".engroup{margin:0 0 10px}",
    ".engrouphead{font-size:12px;color:var(--fog);margin:0 0 6px;font-weight:700}",
    ".enchips{display:flex;flex-wrap:wrap;gap:6px}",
    ".enchip{font:inherit;font-size:12px;padding:7px 11px;border-radius:999px;border:1px solid rgba(200,185,255,.25);background:rgba(8,6,18,.6);color:var(--fog);cursor:pointer;line-height:1.2;min-height:32px}",
    ".enchip.on{border-color:var(--amber);color:#fff4dc;background:rgba(214,170,90,.16);box-shadow:inset 0 0 0 1px rgba(214,170,90,.35)}",
    ".engrid{width:100%;border-collapse:separate;border-spacing:4px;margin:2px 0 10px;table-layout:fixed}",
    ".engrid th{font-size:12px;font-weight:700;color:var(--fog);text-align:center;padding:0}",
    ".engrid th small{display:block;font-weight:400;color:var(--fogd);font-size:12px}",
    ".engrid tbody th{text-align:left;width:3.2em}",
    ".enslot{width:100%;min-height:34px;border-radius:8px;border:1px solid rgba(200,185,255,.22);background:rgba(8,6,18,.6);color:#fff4dc;font:inherit;font-size:14px;cursor:pointer}",
    ".enslot.on{background:rgba(214,170,90,.22);border-color:var(--amber)}",
    ".encertfiles{margin:4px 0 6px;display:grid;gap:8px}",
    ".encertrow{border:1px solid rgba(200,185,255,.18);border-radius:10px;padding:8px 10px;background:rgba(8,6,18,.45)}",
    ".encertline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".encertname{font-size:12px;font-weight:700;color:var(--paper);flex:1 1 140px}",
    ".enfileok{font-size:12px;color:#bfe8c8;flex:1 1 120px;overflow-wrap:anywhere}",
    ".enfilemiss{font-size:12px;color:var(--amber);flex:1 1 120px}",
    ".enfilebtn{position:relative;overflow:hidden;cursor:pointer}",
    ".enfilebtn input{position:absolute;inset:0;opacity:0;cursor:pointer}",
    ".enck{display:flex;gap:10px;align-items:flex-start;margin:10px 0;font-size:12.5px;color:var(--fog);line-height:1.45;cursor:pointer}",
    ".enck input{margin-top:3px;accent-color:#8B6CFF}",
    ".enhp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}",
    ".enfoot{font-size:12px;color:var(--fogd);margin:6px 0 4px}",
    ".enerr{border:1px solid rgba(255,120,120,.4);background:rgba(255,90,90,.08);color:#ffb3b3;border-radius:10px;padding:10px 12px;font-size:12.5px;margin:0 0 10px}",
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
    "@media (max-width:520px){.enpres{grid-template-columns:repeat(2,1fr)}.enkinds{gap:6px}.enkind{padding:7px 2px;gap:2px}.enkind span{font-size:15px}.enrow2{grid-template-columns:1fr}.backdrop:has(.enform){padding:10px 8px}.modal:has(.enform),.enform{max-height:calc(100dvh - 20px)}.enhead{padding:14px 14px 2px}.enbody{padding:4px 14px 10px}.enfootbar{padding:10px 14px 12px}}"
  ].join("\n");
  document.head.appendChild(css);
})();

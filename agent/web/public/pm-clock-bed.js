/*
 * Portal clock (/tonal, /portal, /studies) — same voices as the orrery:
 * woody second knock, minute / hour bells, and the Schumann harmonic bed.
 * Every pitch is an integer multiple of 7.83 Hz (see lib/clockVoices.ts).
 * TUNING must stay identical to CLOCK_TUNING — clockVoices.test.ts checks it.
 * Respects localStorage "delphi-clock-sfx" === "0" (sound off).
 */
(function pmClockBed() {
  "use strict";
  var SCHUMANN_HZ = 7.83;
  var TUNING = {"tick":{"body":[24,12],"tip":96,"knock":64},"tock":{"body":[18,9],"tip":72,"knock":48},"minute":{"fundamental":12},"hour":{"fundamental":8},"bellPartials":[1,1.5,2,3,4,4.5],"bellLevels":[1,0.55,0.38,0.22,0.14,0.08],"hourGapS":1.55};
  var BED_HARMONICS = [7.83, 14.3, 20.8, 27.3, 33.8];
  var ROOT_HZ = SCHUMANN_HZ * 16;
  var MASTER_LEVEL = 0.8;
  var BED_LEVEL = 0.35;
  var SFX_KEY = "delphi-clock-sfx";

  function soundOff() {
    try { return localStorage.getItem(SFX_KEY) === "0"; } catch (e) { return true; }
  }
  function h(n) { return SCHUMANN_HZ * n; }

  var ctx = null, master = null, bedGain = null, noise = null;
  var bedSources = [];
  var lastSec = -1, lastChime = "";

  function makeNoise() {
    var len = Math.floor(ctx.sampleRate * 1.5);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ramp(param, to, sec) {
    var t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(0.0001, param.value), t);
    param.exponentialRampToValueAtTime(Math.max(0.0001, to), t + sec);
  }

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(limiter);
    bedGain = ctx.createGain();
    bedGain.gain.value = 0.0001;
    bedGain.connect(master);
    noise = makeNoise();
    return true;
  }

  function startBed() {
    if (bedSources.length) return;
    var carrier = ctx.createOscillator(), cg = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = ROOT_HZ / 2;
    cg.gain.value = 0.22;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = SCHUMANN_HZ;
    lg.gain.value = 0.14;
    lfo.connect(lg); lg.connect(cg.gain);
    carrier.connect(cg); cg.connect(bedGain);
    carrier.start(); lfo.start();
    bedSources.push(carrier, lfo);

    BED_HARMONICS.forEach(function (hz) {
      var o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "sine";
      o.frequency.value = hz;
      lp.type = "lowpass";
      lp.frequency.value = Math.max(80, hz * 6);
      g.gain.value = hz === SCHUMANN_HZ ? 0.12 : 0.045;
      o.connect(lp); lp.connect(g); g.connect(bedGain);
      o.start();
      bedSources.push(o);
    });

    var hiss = ctx.createBufferSource(), hl = ctx.createBiquadFilter(), hg = ctx.createGain();
    hiss.buffer = noise; hiss.loop = true;
    hl.type = "lowpass"; hl.frequency.value = 180;
    hg.gain.value = 0.03;
    hiss.connect(hl); hl.connect(hg); hg.connect(bedGain);
    hiss.start();
    bedSources.push(hiss);
    ramp(bedGain.gain, BED_LEVEL, 2.2);
  }

  function woodKnock(high, t) {
    var v = high ? TUNING.tick : TUNING.tock;
    var knock = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), kg = ctx.createGain();
    knock.buffer = noise;
    bp.type = "bandpass"; bp.frequency.setValueAtTime(h(v.knock), t); bp.Q.setValueAtTime(1.8, t);
    kg.gain.setValueAtTime(high ? 0.1 : 0.085, t);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    knock.connect(bp); bp.connect(kg); kg.connect(master);
    knock.start(t); knock.stop(t + 0.07);

    var body = ctx.createOscillator(), lp = ctx.createBiquadFilter(), bg = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(h(v.body[0]), t);
    body.frequency.exponentialRampToValueAtTime(h(v.body[1]), t + 0.18);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t);
    bg.gain.setValueAtTime(high ? 0.085 : 0.07, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    body.connect(lp); lp.connect(bg); bg.connect(master);
    body.start(t); body.stop(t + 0.24);

    var tip = ctx.createOscillator(), tg = ctx.createGain();
    tip.type = "sine"; tip.frequency.setValueAtTime(h(v.tip), t);
    tg.gain.setValueAtTime(0.03, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    tip.connect(tg); tg.connect(master);
    tip.start(t); tip.stop(t + 0.05);
  }

  function echo(delayS, feedback, wet) {
    var input = ctx.createGain(), delay = ctx.createDelay(2), fb = ctx.createGain();
    var wg = ctx.createGain(), lp = ctx.createBiquadFilter();
    delay.delayTime.value = delayS; fb.gain.value = feedback; wg.gain.value = wet;
    lp.type = "lowpass"; lp.frequency.value = 2200;
    input.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
    lp.connect(wg); wg.connect(master);
    return input;
  }

  function bellStrike(fund, peak, dur, t) {
    var tail = echo(0.42, 0.38, 0.32), room = echo(0.88, 0.25, 0.2);
    TUNING.bellPartials.forEach(function (mult, i) {
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      var f = fund * mult;
      o.type = i === 2 || i === 5 ? "triangle" : "sine";
      o.frequency.setValueAtTime(f, t);
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(3500, f * 6), t);
      lp.frequency.exponentialRampToValueAtTime(400, t + dur);
      var p = peak * TUNING.bellLevels[i];
      var end = t + dur * (1 - i * 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p, t + 0.02);
      g.gain.exponentialRampToValueAtTime(p * 0.35, t + (end - t) * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(lp); lp.connect(g); g.connect(master); g.connect(tail); g.connect(room);
      o.start(t); o.stop(end + 0.05);
    });
    var mallet = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), mg = ctx.createGain();
    mallet.buffer = noise;
    bp.type = "bandpass"; bp.frequency.setValueAtTime(fund * 3, t); bp.Q.setValueAtTime(1.2, t);
    mg.gain.setValueAtTime(peak * 0.3, t);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    mallet.connect(bp); bp.connect(mg); mg.connect(master); mg.connect(tail);
    mallet.start(t); mallet.stop(t + 0.14);
  }

  function running() {
    return ctx && ctx.state === "running" && document.visibilityState !== "hidden" && !soundOff();
  }

  function frame() {
    if (running()) {
      var d = new Date(), s = d.getSeconds();
      if (s !== lastSec) {
        lastSec = s;
        var t = ctx.currentTime;
        woodKnock(s % 2 === 0, t);
        if (s === 0) {
          var key = d.getHours() + ":" + d.getMinutes();
          if (key !== lastChime) {
            lastChime = key;
            if (d.getMinutes() === 0) {
              var strikes = d.getHours() % 12 || 12;
              for (var i = 0; i < strikes; i++) bellStrike(h(TUNING.hour.fundamental), 0.34, 3.8, t + i * TUNING.hourGapS);
            } else {
              bellStrike(h(TUNING.minute.fundamental), 0.3, 3.2, t);
            }
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }

  function wake() {
    if (soundOff()) return;
    if (!ctx && !build()) return;
    var p = ctx.resume();
    var go = function () {
      startBed();
      ramp(master.gain, MASTER_LEVEL, 1.2);
    };
    if (p && p.then) p.then(go, function () {}); else go();
  }

  function park() {
    if (!ctx) return;
    ramp(master.gain, 0.0001, 0.4);
    setTimeout(function () {
      if (ctx && (document.visibilityState === "hidden" || soundOff())) void ctx.suspend();
    }, 450);
  }

  function onGesture() {
    wake();
    if (ctx && ctx.state === "running") {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    }
  }

  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") park();
    else if (ctx) wake();
  });
  window.addEventListener("pagehide", park);
  window.addEventListener("storage", function (e) {
    if (e.key !== SFX_KEY) return;
    if (soundOff()) park(); else if (ctx) wake();
  });
  // Arriving from the app with a live gesture often allows an immediate start.
  wake();
  requestAnimationFrame(frame);
})();

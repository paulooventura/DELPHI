import { describe, expect, it } from "vitest";
import {
  CARD_LIMIT_CENTS,
  cancellation,
  fundingMethodAllowed,
  markAttendance,
  crewAutoPayDue,
  DEFAULT_RULES,
  nextStatus,
  payOrder,
  splitCents,
  staffBudget,
  staffLock,
  ticketsOpen,
  type Booking,
  type Funding,
  type NightState,
} from "./nights";

const H = 3_600_000;
const bookings: Booking[] = [
  { id: "b1", kind: "crew", payee: "sound", agreedCents: 30_000, accepted: true },
  { id: "b2", kind: "crew", payee: "door", agreedCents: 20_000, accepted: true },
  { id: "b3", kind: "venue", payee: "venue", agreedCents: 100_000 },
];
const noFees = { ...DEFAULT_RULES, payoutFeeCents: () => 0 };

describe("staff budget and the lock", () => {
  it("adds agreed crew pay, a 10% overtime buffer and payout fees (venue is not staff)", () => {
    const b = staffBudget(bookings);
    expect(b.payCents).toBe(50_000);
    expect(b.bufferCents).toBe(5_000);
    expect(b.feesCents).toBe(Math.ceil(33_000 * 0.0025) + 25 + Math.ceil(22_000 * 0.0025) + 25);
    expect(b.totalCents).toBe(b.payCents + b.bufferCents + b.feesCents);
  });

  it("holds until the whole budget is in and cleared; pending money never counts", () => {
    const need = staffBudget(bookings, noFees).totalCents;
    const pending: Funding[] = [{ by: "owner", cents: need, cleared: false }];
    expect(staffLock(bookings, pending, noFees).funded).toBe(false);
    const cleared: Funding[] = [{ by: "owner", cents: need, cleared: true }];
    expect(staffLock(bookings, cleared, noFees)).toMatchObject({ funded: true, gapCents: 0 });
  });
});

describe("the night's states", () => {
  const base = (over: Partial<NightState>): NightState => ({ status: "draft", bookings, fundings: [], ...over });

  it("can't go live or open tickets before the staff budget is funded", () => {
    expect(nextStatus(base({ status: "budgeted" }), "go-live", 0).ok).toBe(false);
    const r = nextStatus(base({ status: "budgeted" }), "fund-cleared", 0);
    expect(r.ok).toBe(false);
    expect(ticketsOpen("budgeted")).toBe(false);
    expect(ticketsOpen("funded")).toBe(true);
  });

  it("walks draft → budgeted → funded → live → ended → paid → closed", () => {
    const need = staffBudget(bookings).totalCents;
    const funded = [{ by: "owner", cents: need, cleared: true }];
    expect(nextStatus(base({}), "budget", 0)).toEqual({ ok: true, status: "budgeted" });
    expect(nextStatus(base({ status: "budgeted", fundings: funded }), "fund-cleared", 0)).toEqual({ ok: true, status: "funded" });
    expect(nextStatus(base({ status: "funded", fundings: funded }), "go-live", 0)).toEqual({ ok: true, status: "live" });
    expect(nextStatus(base({ status: "live" }), "end", 0)).toEqual({ ok: true, status: "ended" });
    expect(nextStatus(base({ status: "paid" }), "close", 0)).toEqual({ ok: true, status: "closed" });
  });

  it("crew must accept before the lock counts", () => {
    const need = staffBudget(bookings).totalCents;
    const unaccepted = bookings.map(b => (b.id === "b2" ? { ...b, accepted: false } : b));
    const r = nextStatus({ status: "budgeted", bookings: unaccepted, fundings: [{ by: "o", cents: need, cleared: true }] }, "fund-cleared", 0);
    expect(r.ok).toBe(false);
  });

  it("Pay waits out the 48-hour incident window; crew are auto-paid at 72 hours", () => {
    const ended = base({ status: "ended", endedAtMs: 0 });
    expect(nextStatus(ended, "pay", 47 * H).ok).toBe(false);
    expect(nextStatus(ended, "pay", 48 * H)).toEqual({ ok: true, status: "paid" });
    expect(crewAutoPayDue(ended, 71 * H)).toBe(false);
    expect(crewAutoPayDue(ended, 72 * H)).toBe(true);
  });
});

describe("what Pay does", () => {
  it("pays crew, then costs, then fees, then backers back, then the upside, to the cent", () => {
    const fundings: Funding[] = [
      { by: "owner", cents: 55_000, cleared: true },
      { by: "ana", cents: 60_000, cleared: true, backer: true },
      { by: "bo", cents: 40_000, cleared: true, backer: true },
    ];
    const r = payOrder({ bookings, fundings, ticketCents: 150_000, shares: { ana: 1, bo: 1, promoter: 1 } }, noFees);
    if (!r.ok) throw new Error("expected ok");
    expect(r.lines.map(l => l.step)).toEqual([...r.lines.map(l => l.step)].sort((a, b) => a - b));
    expect(r.lines.filter(l => l.step === 1).map(l => l.cents)).toEqual([30_000, 20_000]);
    expect(r.lines.find(l => l.step === 4 && l.payee === "ana")!.cents).toBe(60_000);
    const total = r.lines.reduce((s, l) => s + l.cents, 0);
    expect(total).toBe(r.potCents);
  });

  it("a flop: crew and costs first, backers get what is left in proportion, no upside", () => {
    const fundings: Funding[] = [
      { by: "owner", cents: 50_000, cleared: true },
      { by: "ana", cents: 100_000, cleared: true, backer: true },
      { by: "bo", cents: 50_000, cleared: true, backer: true },
    ];
    const r = payOrder({ bookings, fundings, ticketCents: 30_000, shares: { ana: 1 } }, noFees);
    if (!r.ok) throw new Error("expected ok");
    const recoup = r.lines.filter(l => l.step === 4);
    expect(recoup.find(l => l.payee === "ana")!.cents).toBe(53_333);
    expect(recoup.find(l => l.payee === "bo")!.cents).toBe(26_667);
    expect(r.lines.some(l => l.step === 5)).toBe(false);
  });

  it("refuses to run when the pot can't cover crew and costs, and names the shortfall", () => {
    const r = payOrder({ bookings, fundings: [{ by: "owner", cents: 55_000, cleared: true }], ticketCents: 20_000, shares: {} }, noFees);
    expect(r).toEqual({ ok: false, shortfallCents: 75_000, lines: [] });
  });
});

describe("cancellation and splitting", () => {
  it("inside 72 hours crew get half their agreed pay; the rest goes back pro rata", () => {
    const fundings: Funding[] = [
      { by: "owner", cents: 60_000, cleared: true },
      { by: "ana", cents: 40_000, cleared: true, backer: true },
    ];
    const late = cancellation({ bookings, fundings, hoursBeforeNight: 24 });
    expect(late.crew.map(l => l.cents)).toEqual([15_000, 10_000]);
    expect(late.refunds).toEqual({ owner: 45_000, ana: 30_000 });
    const early = cancellation({ bookings, fundings, hoursBeforeNight: 200 });
    expect(early.crew).toEqual([]);
    expect(early.refunds).toEqual({ owner: 60_000, ana: 40_000 });
  });

  it("splits to whole cents that add up exactly", () => {
    const s = splitCents(100, { a: 1, b: 1, c: 1 });
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(100);
    expect(Math.max(...Object.values(s)) - Math.min(...Object.values(s))).toBeLessThanOrEqual(1);
  });
});

describe("Paulo's rules (2026-11-12)", () => {
  const rich: Funding[] = [
    { by: "owner", cents: 150_000, cleared: true },
    { by: "ana", cents: 50_000, cleared: true, backer: true },
  ];

  it("Pneuma takes 5% of profit only, after crew, costs and the backers' money back", () => {
    const r = payOrder({ bookings, fundings: rich, ticketCents: 100_000, shares: { ana: 1 } }, noFees);
    if (!r.ok) throw new Error("expected ok");
    // pot 300,000 - crew 50,000 - venue 100,000 - recoup 50,000 = profit 100,000
    expect(r.lines.find(l => l.payee === "pneuma")!.cents).toBe(5_000);
    expect(r.lines.reduce((s, l) => s + l.cents, 0)).toBe(r.potCents);
  });

  it("a night that breaks even or loses pays Pneuma nothing", () => {
    const r = payOrder({ bookings, fundings: rich, ticketCents: 0, shares: { ana: 1 } }, noFees);
    if (!r.ok) throw new Error("expected ok");
    expect(r.lines.some(l => l.payee === "pneuma")).toBe(false);
  });

  it("crew who drop out aren't paid and leave the staff budget", () => {
    const out = bookings.map(b => (b.id === "b2" ? { ...b, withdrawn: true } : b));
    expect(staffBudget(out, noFees).payCents).toBe(30_000);
    const r = payOrder({ bookings: out, fundings: rich, ticketCents: 0, shares: {} }, noFees);
    if (!r.ok) throw new Error("expected ok");
    expect(r.lines.some(l => l.payee === "door")).toBe(false);
  });

  it("only the steward records attendance, and a no-show isn't paid", () => {
    expect(markAttendance(bookings[1]!, "owner", "pm-1", false)).toEqual({ error: "Only the night's steward records who showed up." });
    const marked = markAttendance(bookings[1]!, "pm-1", "pm-1", false) as Booking;
    expect(marked.attended).toBe(false);
    const r = payOrder({ bookings: [bookings[0]!, marked, bookings[2]!], fundings: rich, ticketCents: 0, shares: {} }, noFees);
    if (!r.ok) throw new Error("expected ok");
    expect(r.lines.some(l => l.payee === "door")).toBe(false);
  });

  it("cancelled: pre-event work is paid as delivered; night crew get nothing 72+ hours out", () => {
    const withPromo: Booking[] = [...bookings, { id: "p1", kind: "crew", payee: "promo", agreedCents: 40_000, preEvent: true, deliveredCents: 25_000, accepted: true }];
    const early = cancellation({ bookings: withPromo, fundings: rich, hoursBeforeNight: 100 });
    expect(early.crew).toEqual([{ step: 1, label: "Pre-event work", payee: "promo", cents: 25_000 }]);
    const late = cancellation({ bookings: withPromo, fundings: rich, hoursBeforeNight: 10 });
    expect(late.crew.map(l => l.payee)).toEqual(["promo", "sound", "door"]);
  });

  it("over $1,000 funding goes by bank transfer", () => {
    expect(CARD_LIMIT_CENTS).toBe(100_000);
    expect(fundingMethodAllowed(100_000, "card")).toBe(true);
    expect(fundingMethodAllowed(100_001, "card")).toBe(false);
    expect(fundingMethodAllowed(500_000, "bank")).toBe(true);
  });
});

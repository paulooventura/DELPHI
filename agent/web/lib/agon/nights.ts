/**
 * Agon nights, no money yet (T497; Homebase staging/delphi/AGON-MONEY.md §4, §5, §11; core approved 2026-11-12).
 * ----------------------------------------------------------------------------
 * Pure functions only: the night's states, the staff budget, the lock, the Pay order and cancellation. Money is in
 * whole cents. Nothing here moves money; Stripe Connect comes later (T499), after the lawyer and Paulo's decisions.
 *
 * Paulo's rules (2026-11-12, Homebase decisions/dec-agon-money-core.md):
 *   - Pneuma's fee is 5% of profit only: nothing on a night that breaks even or loses. Stripe's fees pass at cost.
 *   - The owner cancels: crew get nothing more than 72 hours before, half their pay inside 72 hours. People who did
 *     pre-event work (promo, marketing, design) are paid for the work they delivered either way.
 *   - Crew who drop out before the night aren't paid; the owner books a replacement.
 *   - The night's steward (PM) records who showed up; a no-show isn't paid.
 *   - Funding above $1,000 comes by bank transfer; backers carry their own gain or loss.
 *   - Tickets: option A (the owner sells on Ticket Fairy and pays the ticket income in at Pay).
 * Stripe's payout fee is a placeholder until the platform account opens.
 */

export type NightStatus = "draft" | "budgeted" | "funded" | "live" | "ended" | "paid" | "closed" | "cancelled";

export type BookingKind = "crew" | "venue" | "cost";

export type Booking = {
  id: string;
  kind: BookingKind;
  payee: string;
  /** Agreed pay or cost, in cents. */
  agreedCents: number;
  /** Overtime approved after the night (incident window), in cents. */
  approvedOvertimeCents?: number;
  /** The crew member accepted pay, hours and the cancellation terms. */
  accepted?: boolean;
  /** Dropped out before the night: not paid, and the owner books a replacement. */
  withdrawn?: boolean;
  /** Set by the night's steward only: false = no-show, not paid. */
  attended?: boolean;
  /** Work done before the night (promo, marketing, design): paid for what was delivered, even if the night is cancelled. */
  preEvent?: boolean;
  /** For pre-event work: what was delivered by cancellation time, in cents (defaults to the agreed amount). */
  deliveredCents?: number;
};

export type Funding = {
  by: string;
  cents: number;
  /** Cleared in Stripe (a pending charge never counts). */
  cleared: boolean;
  /** Paid as a backer (recouped in the Pay order) rather than by the owner covering costs. */
  backer?: boolean;
};

export type Shares = Record<string, number>;

export type NightMoneyRules = {
  /** Overtime buffer on top of agreed crew pay. */
  overtimeBuffer: number;
  /** Stripe's fee on one payout, in cents. PLACEHOLDER until checked against Stripe's live Connect pricing. */
  payoutFeeCents: (amountCents: number) => number;
  /** Pneuma's share of the night's profit (what is left after crew, costs, Stripe and the backers' money back). */
  profitFeeShare: number;
  /** Crew cancellation pay as a share of agreed pay, by hours before the night (when the owner cancels). */
  cancellationShare: (hoursBefore: number) => number;
  /** Share of the upside kept as the reserve / next seed. */
  reserveShare: number;
};

export const DEFAULT_RULES: NightMoneyRules = {
  overtimeBuffer: 0.1,
  // Stripe Connect payouts are about 0.25% + 25¢ each in the US (placeholder; confirm when the platform account opens).
  payoutFeeCents: a => (a > 0 ? Math.ceil(a * 0.0025) + 25 : 0),
  profitFeeShare: 0.05,
  // Nothing more than 72 hours before the night; half the agreed pay inside 72 hours.
  cancellationShare: h => (h < 72 ? 0.5 : 0),
  reserveShare: 0,
};

/** Hours after the night ends: incident notes first, then Pay; the crew are auto-paid if nobody pressed it. */
export const INCIDENT_WINDOW_H = 48;
export const CREW_AUTOPAY_H = 72;

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
/** Crew still on the night (a withdrawn crew member is replaced, never paid). */
const crew = (b: Booking[]) => b.filter(x => x.kind === "crew" && !x.withdrawn);

/** Above this, funding has to come by bank transfer (card charges can be clawed back weeks later). */
export const CARD_LIMIT_CENTS = 100_000;
export const fundingMethodAllowed = (cents: number, method: "card" | "bank") => method === "bank" || cents <= CARD_LIMIT_CENTS;

/** Attendance belongs to the night's steward: anyone else is refused. */
export function markAttendance(b: Booking, by: string, stewardId: string, attended: boolean): Booking | { error: string } {
  if (by !== stewardId) return { error: "Only the night's steward records who showed up." };
  if (b.kind !== "crew") return { error: "Attendance is for crew bookings." };
  return { ...b, attended };
}

export type StaffBudget = { payCents: number; bufferCents: number; feesCents: number; totalCents: number };

/** Every crew member's agreed pay, plus the overtime buffer, plus the payout fees on those payouts. */
export function staffBudget(bookings: Booking[], rules: NightMoneyRules = DEFAULT_RULES): StaffBudget {
  const c = crew(bookings);
  const payCents = sum(c.map(b => b.agreedCents));
  const bufferCents = Math.ceil(payCents * rules.overtimeBuffer);
  const feesCents = sum(c.map(b => rules.payoutFeeCents(Math.ceil(b.agreedCents * (1 + rules.overtimeBuffer)))));
  return { payCents, bufferCents, feesCents, totalCents: payCents + bufferCents + feesCents };
}

export const clearedCents = (fundings: Funding[]) => sum(fundings.filter(f => f.cleared).map(f => f.cents));

/** The lock: the night can't go live, and tickets can't open, until the whole staff budget is in and cleared. */
export function staffLock(bookings: Booking[], fundings: Funding[], rules: NightMoneyRules = DEFAULT_RULES) {
  const need = staffBudget(bookings, rules).totalCents;
  const have = clearedCents(fundings);
  return { needCents: need, haveCents: have, gapCents: Math.max(0, need - have), funded: need > 0 && have >= need };
}

export type NightEvent = "budget" | "fund-cleared" | "go-live" | "end" | "pay" | "close" | "cancel";

export type NightState = {
  status: NightStatus;
  bookings: Booking[];
  fundings: Funding[];
  /** When the night ended (ms), set by "end". */
  endedAtMs?: number;
};

export type Step = { ok: true; status: NightStatus } | { ok: false; reason: string };

/** The night's state machine (AGON-MONEY §4). Guards say in plain words why a step is refused. */
export function nextStatus(night: NightState, event: NightEvent, nowMs: number, rules: NightMoneyRules = DEFAULT_RULES): Step {
  const s = night.status;
  const lock = staffLock(night.bookings, night.fundings, rules);
  const no = (reason: string): Step => ({ ok: false, reason });
  switch (event) {
    case "budget":
      if (s !== "draft") return no("Only a draft night can be budgeted.");
      if (!crew(night.bookings).length) return no("Book the crew first.");
      return { ok: true, status: "budgeted" };
    case "fund-cleared":
      if (s !== "budgeted") return no("Funding counts toward the lock only once the night is budgeted.");
      if (crew(night.bookings).some(b => !b.accepted)) return no("Every crew member has to accept their booking first.");
      return lock.funded ? { ok: true, status: "funded" } : no(`The staff budget is not fully in: ${lock.gapCents} cents to go.`);
    case "go-live":
      if (s !== "funded") return no("The night goes live only after the staff budget is fully funded.");
      return lock.funded ? { ok: true, status: "live" } : no("The staff budget is no longer fully funded.");
    case "end":
      return s === "live" ? { ok: true, status: "ended" } : no("Only a live night can end.");
    case "pay": {
      if (s !== "ended") return no("Pay runs after the night has ended.");
      const h = night.endedAtMs == null ? 0 : (nowMs - night.endedAtMs) / 3_600_000;
      return h >= INCIDENT_WINDOW_H ? { ok: true, status: "paid" } : no(`Incident notes stay open for ${INCIDENT_WINDOW_H} hours after the night.`);
    }
    case "close":
      return s === "paid" ? { ok: true, status: "closed" } : no("A night closes after Pay.");
    case "cancel":
      return ["draft", "budgeted", "funded", "live"].includes(s) ? { ok: true, status: "cancelled" } : no("This night can no longer be cancelled.");
  }
}

/** Tickets open only once the staff lock holds. */
export const ticketsOpen = (status: NightStatus) => status === "funded" || status === "live";

/** The crew are paid from the locked budget once 72 hours have passed since the night without Pay. */
export function crewAutoPayDue(night: NightState, nowMs: number): boolean {
  return night.status === "ended" && night.endedAtMs != null && nowMs - night.endedAtMs >= CREW_AUTOPAY_H * 3_600_000;
}

/** Split `cents` by weights into whole cents that add up exactly (largest remainder). */
export function splitCents(cents: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights).filter(k => weights[k]! > 0);
  const total = sum(keys.map(k => weights[k]!));
  const out: Record<string, number> = {};
  if (cents <= 0 || total <= 0) return out;
  const raw = keys.map(k => ({ k, v: (cents * weights[k]!) / total }));
  for (const r of raw) out[r.k] = Math.floor(r.v);
  let left = cents - sum(Object.values(out));
  for (const r of [...raw].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || a.k.localeCompare(b.k))) {
    if (left <= 0) break;
    out[r.k]! += 1;
    left -= 1;
  }
  return out;
}

export type PayLine = { step: 1 | 2 | 3 | 4 | 5 | 6; label: string; payee: string; cents: number };

export type PayResult =
  | { ok: true; lines: PayLine[]; potCents: number; leftCents: number }
  /** The pot can't cover crew, costs and fees: the owner pays the shortfall in before anything moves. */
  | { ok: false; shortfallCents: number; lines: [] };

/**
 * What Pay does (AGON-MONEY §5): 1 crew (agreed + approved overtime, always whole), 2 venue and fixed costs,
 * 3 fees (payout fees and Pneuma's fee), 4 backers' money back in proportion, 5 the upside split by the agreed
 * shares, 6 the reserve. `potCents` is everything the night holds: fundings plus ticket income.
 */
export function payOrder(
  input: { bookings: Booking[]; fundings: Funding[]; ticketCents: number; shares: Shares },
  rules: NightMoneyRules = DEFAULT_RULES,
): PayResult {
  const potCents = clearedCents(input.fundings) + Math.max(0, input.ticketCents);
  const lines: PayLine[] = [];
  const crewLines = crew(input.bookings)
    .filter(b => b.preEvent || b.attended !== false)
    .map(b => ({ b, cents: b.agreedCents + (b.approvedOvertimeCents ?? 0) }));
  const costLines = input.bookings.filter(b => b.kind !== "crew").map(b => ({ b, cents: b.agreedCents }));
  const payoutFees = sum([...crewLines, ...costLines].map(l => rules.payoutFeeCents(l.cents)));
  const fixed = sum(crewLines.map(l => l.cents)) + sum(costLines.map(l => l.cents)) + payoutFees;
  if (fixed > potCents) return { ok: false, shortfallCents: fixed - potCents, lines: [] };

  for (const l of crewLines) lines.push({ step: 1, label: "Crew", payee: l.b.payee, cents: l.cents });
  for (const l of costLines) lines.push({ step: 2, label: l.b.kind === "venue" ? "Venue" : "Cost", payee: l.b.payee, cents: l.cents });
  if (payoutFees) lines.push({ step: 3, label: "Payout fees", payee: "stripe", cents: payoutFees });
  let left = potCents - fixed;

  const backed: Record<string, number> = {};
  for (const f of input.fundings) if (f.cleared && f.backer) backed[f.by] = (backed[f.by] ?? 0) + f.cents;
  const backedTotal = sum(Object.values(backed));
  const recoup = Math.min(left, backedTotal);
  for (const [payee, cents] of Object.entries(splitCents(recoup, backed))) lines.push({ step: 4, label: "Backer recoup", payee, cents });
  left -= recoup;

  if (left > 0) {
    // Profit: Pneuma's share first, then the agreed split.
    const fee = Math.floor(left * rules.profitFeeShare);
    if (fee > 0) lines.push({ step: 5, label: "Pneuma fee (5% of profit)", payee: "pneuma", cents: fee });
    left -= fee;
    const reserve = Math.floor(left * rules.reserveShare);
    const upside = left - reserve;
    for (const [payee, cents] of Object.entries(splitCents(upside, input.shares))) lines.push({ step: 5, label: "Upside", payee, cents });
    const paidUpside = sum(lines.filter(l => l.step === 5 && l.payee !== "pneuma").map(l => l.cents));
    const toReserve = left - paidUpside;
    if (toReserve > 0) lines.push({ step: 6, label: "Reserve", payee: "reserve", cents: toReserve });
    left = 0;
  }
  return { ok: true, lines, potCents, leftCents: left };
}

/** Cancelled: crew get cancellation pay from the locked budget; the rest goes back to whoever funded it, pro rata. */
export function cancellation(
  input: { bookings: Booking[]; fundings: Funding[]; hoursBeforeNight: number },
  rules: NightMoneyRules = DEFAULT_RULES,
): { crew: PayLine[]; refunds: Record<string, number> } {
  const share = Math.max(0, Math.min(1, rules.cancellationShare(input.hoursBeforeNight)));
  const pot = clearedCents(input.fundings);
  let left = pot;
  const crewPay: PayLine[] = [];
  for (const b of input.bookings.filter(x => x.preEvent && !x.withdrawn)) {
    const cents = Math.min(left, Math.max(0, b.deliveredCents ?? b.agreedCents));
    if (cents > 0) crewPay.push({ step: 1, label: "Pre-event work", payee: b.payee, cents });
    left -= cents;
  }
  for (const b of crew(input.bookings).filter(x => !x.preEvent)) {
    const cents = Math.min(left, Math.floor(b.agreedCents * share));
    if (cents > 0) crewPay.push({ step: 1, label: "Cancellation pay", payee: b.payee, cents });
    left -= cents;
  }
  const funded: Record<string, number> = {};
  for (const f of input.fundings) if (f.cleared) funded[f.by] = (funded[f.by] ?? 0) + f.cents;
  return { crew: crewPay, refunds: splitCents(left, funded) };
}

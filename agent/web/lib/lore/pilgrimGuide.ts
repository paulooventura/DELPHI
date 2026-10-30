/**
 * Pilgrim guide — first-run walk shown at the last frame of each opening film.
 * Each box pairs what pilgrims did at Delphi (`then`) with what the user does here (`now`).
 *
 * Sources:
 * - Consultation days: Plutarch, Greek Questions 9 (once a year on Apollo's birthday, the 7th of
 *   Bysios; later the 7th of each month, not in the winter months). Ancient accounts differ, so "it's said".
 * - Castalian spring: Pausanias 10.8.9; Euripides, Ion 94–97 (temple servants wash in Castalia);
 *   the Pythia's bathing there is from later testimony (scholia, Heliodorus), hence "it's said".
 * - Sacred Way and treasuries: Pausanias 10.9–10.11; "Know thyself" in the forecourt: Pausanias 10.24.1.
 * - Pelanos cake as the consultation fee, offered at the altar: Euripides, Ion 226–229; Delphic
 *   pelanos agreements with Phaselis and Skiathos (inscriptions).
 * - Goat sprinkled with cold water, consulting only if it trembled: Plutarch, On the Obsolescence of Oracles 49 (437a–b).
 */

export type PilgrimStepId = "historical" | "pythia" | "stairs" | "void";

export type PilgrimStep = {
  id: PilgrimStepId;
  step: number;
  title: string;
  then: string;
  now: string;
  cta: string;
};

export const PILGRIM_INTRO: { title: string; body: string } = {
  title: "The pilgrim's walk",
  body: "A short guided walk through the steps pilgrims took at Delphi, and what each one means here. You can skip it anytime.",
};

export const PILGRIM_STEPS: readonly PilgrimStep[] = [
  {
    id: "historical",
    step: 1,
    title: "Arriving at Delphi",
    then: "Pilgrims travelled for days, by road or by sea, to reach Delphi on the slopes of Parnassus. The oracle spoke only on set days, it's said once a month, so many waited their turn.",
    now: "You've arrived too: Pneuma is a living map of the sky and of time.",
    cta: "Walk on",
  },
  {
    id: "pythia",
    step: 2,
    title: "The Castalian spring",
    then: "Before going up, pilgrims purified themselves at the Castalian spring, washing their hands and hair. It's said the Pythia bathed there too before she spoke.",
    now: "Pause here. A clear mind and one honest question are all you need to bring.",
    cta: "Climb",
  },
  {
    id: "stairs",
    step: 3,
    title: "The Sacred Way",
    then: "The Sacred Way wound uphill past treasuries and gifts from many cities to the temple of Apollo. At its entrance was carved: Know thyself.",
    now: "Pneuma's chambers line your way: Aether's sky, Heliodrome's clock, Mouseion's learning, Agon's gathering, and Psyche, your own chart, kept on this device.",
    cta: "Enter the temple",
  },
  {
    id: "void",
    step: 4,
    title: "The offering",
    then: "To consult the oracle, pilgrims offered a sacred cake, the pelanos, at the altar as their fee. A goat was sprinkled with cold water; if it trembled, the day was right and the question could be asked.",
    now: "Here you bring attention and a question, nothing more. A Cast reading is a mirror to reflect with, not a prediction.",
    cta: "Begin",
  },
];

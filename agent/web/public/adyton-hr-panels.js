/**
 * Adyton — Time in Body + Risk Modulators (harm-reduction panels).
 * Ranges only. Inform decisions; never compute "you'll be clear" or a safe dose.
 * Approximate windows drawn from commonly published TripSit / DanceSafe / Erowid
 * duration sheets and widely republished clinical immunoassay tables (SAMHSA-style).
 * Always verify against those orgs for the specific form and test.
 */
(function (global) {
  const DISCLAIMER =
    "Not medical advice. Emergency → call your local emergency number (US: 911 · 988 · Poison Control 1-800-222-1222).";

  const FRAME_TIME =
    "All values are approximate RANGES. They vary by person, dose, frequency, route, purity, and test type. Detectable ≠ affected. Undetectable is never guaranteed. This is not a personal calculator — no “you’ll be clear by X.” Use it to decide whether to partake (e.g. job testing), not to beat a test.";

  const FRAME_RISK =
    "These factors RAISE or CHANGE risk — they explain why the same substance hits people differently. They do not output a personal safe dose. If several apply to you, treat that as elevated risk and reconsider.";

  const SOURCES =
    "Cited ranges: TripSit factsheets · DanceSafe · Erowid Duration · common clinical immunoassay tables. Confirm for your specific preparation.";

  /** Shared modulators — mechanism-first, never a dose. */
  const RISK_FACTORS = [
    {
      id: "metabolism",
      title: "Metabolism / enzymes",
      how: "Liver enzymes (e.g. CYP family) clear drugs at different rates. Slow metabolizers keep higher levels longer; fast ones may redose into overshoot.",
    },
    {
      id: "body",
      title: "Body composition",
      how: "Fat-soluble compounds linger in adipose tissue; lower body mass can mean higher concentration for the same amount.",
    },
    {
      id: "tolerance",
      title: "Tolerance / recent use",
      how: "Recent exposure can blunt effects while still loading receptors and detection windows — a false sense of safety.",
    },
    {
      id: "hydration",
      title: "Hydration / electrolytes",
      how: "Dehydration and salt imbalance amplify heat stroke, kidney strain, and stimulant/depressant crashes.",
    },
    {
      id: "meds",
      title: "Co-used medications",
      how: "Prescriptions, OTC, and other drugs share pathways — combinations can multiply respiratory or cardiac risk.",
    },
    {
      id: "conditions",
      title: "Pre-existing conditions",
      how: "Heart, lung, liver, kidney, seizure, or clotting history changes where the overshoot starts.",
    },
    {
      id: "mind",
      title: "Mental state",
      how: "Anxiety, depression, trauma load, or psychosis risk can flip a trip or stimulant rush into crisis.",
    },
    {
      id: "set",
      title: "Set & setting",
      how: "Crowds, heat, isolation, or lack of trusted sober support raise the chance that a hard moment becomes an emergency.",
    },
    {
      id: "route",
      title: "Route of use",
      how: "Injection, smoking, snorting, and swallowing change onset speed and peak height — faster routes leave less time to stop.",
    },
  ];

  /**
   * effect: { onset, peak, duration, after }
   * detection: { blood, urine, saliva, hair, note? }
   * riskFocus: string[] of RISK_FACTORS ids to emphasize
   * riskNote: optional substance-specific mechanism line
   */
  const BY_NAME = {
    Alcohol: {
      effect: {
        onset: "≈10–30 min (drink)",
        peak: "≈30–90 min",
        duration: "≈1–3 h per drink (cumulative)",
        after: "Hangover / impaired judgment can last many hours after “feeling sober”",
      },
      detection: {
        blood: "≈12–24 h",
        urine: "≈10–24 h (EtG tests longer, often 1–3+ days)",
        saliva: "≈12–24 h",
        hair: "≈90 days (segment)",
        note: "EtG/EtS urine tests detect metabolites longer than breath/BAC.",
      },
      riskFocus: ["meds", "conditions", "hydration", "tolerance", "metabolism"],
      riskNote: "Alcohol + other depressants collapses breathing. Liver disease and empty stomach change the curve sharply.",
    },
    Cannabis: {
      effect: {
        onset: "Inhale ≈1–10 min · Edible ≈30–120 min",
        peak: "Inhale ≈10–30 min · Edible ≈2–4 h",
        duration: "Inhale ≈2–4 h · Edible ≈4–12+ h",
        after: "Fog / next-day dullness possible, especially edibles",
      },
      detection: {
        blood: "≈1–2 days (chronic: longer)",
        urine: "≈3–7 days occasional · weeks if frequent",
        saliva: "≈24–72 h",
        hair: "≈90 days",
        note: "THC is fat-soluble — frequency dominates urine windows.",
      },
      riskFocus: ["body", "tolerance", "mind", "set", "route"],
      riskNote: "Edibles delay onset; people redose and overshoot. Anxiety-prone set magnifies panic.",
    },
    Cocaine: {
      effect: {
        onset: "Snort ≈1–5 min · Smoke faster",
        peak: "≈15–30 min",
        duration: "≈15–60 min (main rush)",
        after: "Crash / craving · hours",
      },
      detection: {
        blood: "≈12–48 h",
        urine: "≈2–4 days",
        saliva: "≈1–2 days",
        hair: "≈90 days",
        note: "Benzoylecgonine is the usual urine marker.",
      },
      riskFocus: ["conditions", "meds", "route", "hydration", "tolerance"],
      riskNote: "Cardiac / stroke risk spikes with heart history, alcohol (cocaethylene), and adulterants including fentanyl.",
    },
    Heroin: {
      effect: {
        onset: "IV seconds · Smoke/snort minutes",
        peak: "≈10–30 min",
        duration: "≈3–5 h (variable)",
        after: "Nodding / residual sedation",
      },
      detection: {
        blood: "≈6–12 h (metabolites longer)",
        urine: "≈2–4 days",
        saliva: "≈1–2 days",
        hair: "≈90 days",
        note: "Street supply is often fentanyl — detection and overdose risk follow the cut, not the label.",
      },
      riskFocus: ["meds", "tolerance", "route", "conditions", "metabolism"],
      riskNote: "Respiratory depression with benzos/alcohol. Tolerance loss after abstinence is a classic overdose setup.",
    },
    Fentanyl: {
      effect: {
        onset: "Minutes (route-dependent) — very fast",
        peak: "Rapid",
        duration: "≈1–4 h (analogs vary widely)",
        after: "Re-narcotization possible as naloxone wears off",
      },
      detection: {
        blood: "Hours–≈1 day (analog-dependent)",
        urine: "≈1–3 days (many panels miss analogs)",
        saliva: "≈1–2 days",
        hair: "≈90 days",
        note: "Standard opioid screens may miss fentanyl analogs — a negative test is not safety.",
      },
      riskFocus: ["tolerance", "meds", "route", "metabolism", "conditions"],
      riskNote: "Tiny mass differences are lethal. Never use alone; carry naloxone; test the supply.",
    },
    Nitazenes: {
      effect: {
        onset: "Fast (often opioid-like)",
        peak: "Rapid",
        duration: "Highly variable by analog",
        after: "Prolonged respiratory risk with some analogs",
      },
      detection: {
        blood: "Not standardized",
        urine: "Often missed on common panels",
        saliva: "Not standardized",
        hair: "Not standardized",
        note: "Laboratory confirmation required — home immunoassay may be blind.",
      },
      riskFocus: ["tolerance", "meds", "route", "metabolism"],
      riskNote: "Ultra-potent opioids in the illicit supply — treat unknown powders as high overdose risk.",
    },
    Oxycodone: {
      effect: {
        onset: "Oral ≈10–30 min (IR)",
        peak: "≈30–60 min (IR) · longer if ER",
        duration: "≈3–6 h IR · ER longer",
        after: "Residual sedation",
      },
      detection: {
        blood: "≈24 h",
        urine: "≈2–4 days",
        saliva: "≈1–2 days",
        hair: "≈90 days",
      },
      riskFocus: ["meds", "tolerance", "conditions", "metabolism"],
      riskNote: "ER crushing changes the curve into an immediate overshoot. Depressant combinations kill.",
    },
    Methadone: {
      effect: {
        onset: "Oral ≈30–60 min",
        peak: "≈2–4 h",
        duration: "≈24–36 h (long)",
        after: "Long residual respiratory depression risk",
      },
      detection: {
        blood: "Days",
        urine: "≈3–14 days (dose/chronicity)",
        saliva: "≈1–4 days",
        hair: "≈90 days",
        note: "Long half-life — stacking doses is a classic overdose pattern.",
      },
      riskFocus: ["metabolism", "meds", "tolerance", "conditions"],
      riskNote: "Takes days to stabilize; early redosing while “not feeling it” is dangerous.",
    },
    Kratom: {
      effect: {
        onset: "≈20–40 min oral",
        peak: "≈1–2 h",
        duration: "≈3–6 h",
        after: "Possible next-day lethargy",
      },
      detection: {
        blood: "Not routine",
        urine: "Specialized tests only (often 1– several days if tested)",
        saliva: "Not routine",
        hair: "Not routine",
        note: "Most workplace panels do not include mitragynine unless specifically ordered.",
      },
      riskFocus: ["meds", "tolerance", "metabolism", "conditions"],
      riskNote: "Opioid-receptor activity + other depressants raises respiratory risk. Product potency varies wildly.",
    },
    "Opium poppy": {
      effect: {
        onset: "Tea/oral slower than isolates",
        peak: "Variable",
        duration: "Hours — morphine/codeine driven",
        after: "Sedation / constipation",
      },
      detection: {
        blood: "Hours–≈1 day",
        urine: "≈2–3 days (opiates panel)",
        saliva: "≈1–2 days",
        hair: "≈90 days",
        note: "Poppy-seed foods can trigger some opiate screens — context matters for interpretation, not for “beating” a test.",
      },
      riskFocus: ["meds", "tolerance", "metabolism", "route"],
      riskNote: "Home teas are unmeasured morphine/codeine — treat as opioid respiratory risk.",
    },
    "Amphetamine / MDMA (class)": {
      effect: {
        onset: "Oral ≈30–90 min (MDMA) · amphetamines similar/faster",
        peak: "≈1–3 h",
        duration: "MDMA ≈3–6 h · amphetamines longer",
        after: "Comedown / mid-week flatness common",
      },
      detection: {
        blood: "≈1–2 days",
        urine: "≈2–4 days (chronic amphetamine longer)",
        saliva: "≈1–3 days",
        hair: "≈90 days",
        note: "Class tests do not prove which molecule — adulteration is common.",
      },
      riskFocus: ["hydration", "conditions", "set", "meds", "mind"],
      riskNote: "Heat, dancing, and low fluid/electrolytes drive hyperthermia. Serotonergic meds raise MDMA risk.",
    },
    "Adderall / prescription amphetamine": {
      effect: {
        onset: "IR ≈30–60 min · XR slower",
        peak: "≈1–3 h",
        duration: "IR ≈4–6 h · XR ≈8–12 h",
        after: "Rebound fatigue / appetite crash",
      },
      detection: {
        blood: "≈1–2 days",
        urine: "≈2–4 days",
        saliva: "≈1–3 days",
        hair: "≈90 days",
      },
      riskFocus: ["conditions", "meds", "tolerance", "hydration"],
      riskNote: "Cardiac history and other stimulants compound strain. Diverted/unknown pills may not be what the label says.",
    },
    Methamphetamine: {
      effect: {
        onset: "Smoke/IV rapid · Oral slower",
        peak: "Rapid to ≈1–2 h",
        duration: "≈6–12+ h",
        after: "Prolonged insomnia / crash",
      },
      detection: {
        blood: "≈1–3 days",
        urine: "≈2–5 days (chronic longer)",
        saliva: "≈1–4 days",
        hair: "≈90 days",
      },
      riskFocus: ["conditions", "hydration", "mind", "route", "tolerance"],
      riskNote: "Long stimulation window invites redosing, overheating, and psychosis risk under sleep debt.",
    },
    "Cathinones (bath salts)": {
      effect: {
        onset: "Minutes–≈1 h (route/form)",
        peak: "Variable / often intense",
        duration: "Often ≈2–6 h — analogs differ",
        after: "Agitation / crash",
      },
      detection: {
        blood: "Not standardized",
        urine: "Many missed on amphetamine screens",
        saliva: "Not standardized",
        hair: "Not standardized",
        note: "Synthetic cathinones often require specialized testing.",
      },
      riskFocus: ["mind", "conditions", "set", "route", "hydration"],
      riskNote: "Unpredictable potency and psychiatric agitation — unknown powders are not “research chemicals you can dose.”",
    },
    GHB: {
      effect: {
        onset: "≈10–20 min",
        peak: "≈30–60 min",
        duration: "≈1.5–3 h",
        after: "Sudden deep sleep / amnesia risk",
      },
      detection: {
        blood: "≈6–12 h",
        urine: "≈12 h (often shorter — timing-critical for labs)",
        saliva: "Short window",
        hair: "Limited / specialized",
        note: "Clears fast — absence on a late test does not mean it was never present.",
      },
      riskFocus: ["meds", "tolerance", "set", "metabolism"],
      riskNote: "Alcohol/benzos + GHB = respiratory arrest. Dose–response is steep; measuring cups lie.",
    },
    Benzodiazepines: {
      effect: {
        onset: "≈15–60 min oral (drug-dependent)",
        peak: "≈1–2 h",
        duration: "Hours to >24 h (long-acting agents)",
        after: "Next-day sedation / amnesia",
      },
      detection: {
        blood: "≈1–3 days",
        urine: "≈3–7 days short-acting · weeks if long-acting/chronic",
        saliva: "≈1–3 days",
        hair: "≈90 days",
        note: "Different benzos light up panels differently.",
      },
      riskFocus: ["meds", "tolerance", "metabolism", "conditions"],
      riskNote: "Opioids + benzos are a leading fatal mix. Tolerance and withdrawal are medical issues — not DIY.",
    },
    Ketamine: {
      effect: {
        onset: "Insufflated ≈5–15 min · IM faster",
        peak: "≈20–60 min",
        duration: "≈1–2 h main · afterglow longer",
        after: "Disorientation / bladder irritation with heavy use",
      },
      detection: {
        blood: "≈1 day",
        urine: "≈2–4 days",
        saliva: "≈1–2 days",
        hair: "≈90 days",
      },
      riskFocus: ["set", "mind", "route", "conditions", "meds"],
      riskNote: "Dissociation + unsafe settings (water, traffic, assault risk). Other depressants deepen airway risk.",
    },
    PCP: {
      effect: {
        onset: "Smoke/oral variable — often rapid",
        peak: "Unpredictable",
        duration: "Hours · some effects much longer",
        after: "Prolonged psychosis-like states possible",
      },
      detection: {
        blood: "≈1–3 days",
        urine: "≈3–8 days (chronic longer)",
        saliva: "≈1–3 days",
        hair: "≈90 days",
      },
      riskFocus: ["mind", "set", "conditions", "route"],
      riskNote: "Behavioral emergencies and injury risk dominate — not a “mild dissociative.”",
    },
    DXM: {
      effect: {
        onset: "≈30–60 min",
        peak: "≈2–4 h",
        duration: "≈4–8 h (dose-plateau dependent)",
        after: "Hangover / dissociation fog",
      },
      detection: {
        blood: "≈1 day",
        urine: "≈1–2 days (may trigger PCP false positives on some screens)",
        saliva: "Short",
        hair: "Specialized",
      },
      riskFocus: ["meds", "mind", "metabolism", "conditions"],
      riskNote: "Serotonergic meds (e.g. some antidepressants) raise serotonin toxicity risk. Plateaus are not a dosing guide.",
    },
    "Nitrous oxide": {
      effect: {
        onset: "Seconds",
        peak: "Seconds–1 min",
        duration: "≈1–5 min",
        after: "Brief disorientation",
      },
      detection: {
        blood: "Minutes (not practical)",
        urine: "Not typical",
        saliva: "Not typical",
        hair: "Not typical",
        note: "Workplace drug panels do not target N₂O; oxygen deprivation is the acute danger.",
      },
      riskFocus: ["route", "set", "conditions"],
      riskNote: "Asphyxia, falls, and nerve damage with heavy B12-related use — never mask without oxygen.",
    },
    Salvia: {
      effect: {
        onset: "Smoke seconds · Chew slower",
        peak: "Minutes",
        duration: "≈5–20 min smoked",
        after: "Brief afterglow / confusion",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine workplace target",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["set", "mind", "route"],
      riskNote: "Intense dissociation — injury risk if unsupervised in unsafe space.",
    },
    "Psilocybin mushrooms": {
      effect: {
        onset: "≈20–40 min",
        peak: "≈1.5–3 h",
        duration: "≈4–6 h",
        after: "Afterglow / emotional residue hours–next day",
      },
      detection: {
        blood: "Hours",
        urine: "≈1–3 days (often not on standard 5-panel)",
        saliva: "Short",
        hair: "Specialized / uncommon",
        note: "Standard employment panels usually omit psychedelics unless expanded.",
      },
      riskFocus: ["mind", "set", "conditions", "meds"],
      riskNote: "Set/setting and mental-health history dominate outcomes. Serotonergic meds change risk.",
    },
    LSD: {
      effect: {
        onset: "≈30–90 min",
        peak: "≈2–4 h",
        duration: "≈8–12 h",
        after: "Long afterglow / sleep debt",
      },
      detection: {
        blood: "Hours",
        urine: "≈1–3 days (specialized; often absent from 5-panel)",
        saliva: "Short",
        hair: "Specialized",
      },
      riskFocus: ["mind", "set", "meds", "conditions"],
      riskNote: "Duration outlasts plans. Stimulant adulterants in “LSD” change the medical picture.",
    },
    Ayahuasca: {
      effect: {
        onset: "≈30–60 min",
        peak: "≈1.5–3 h",
        duration: "≈4–6+ h",
        after: "Purge / emotional integration period",
      },
      detection: {
        blood: "Hours (DMT short; harmala alkaloids longer)",
        urine: "Often specialized",
        saliva: "Short",
        hair: "Specialized",
        note: "MAOI activity matters more than immunoassay windows — medication interactions can be lethal.",
      },
      riskFocus: ["meds", "conditions", "mind", "set"],
      riskNote: "MAOI + many meds/foods/drugs = hypertensive crisis. This is ceremonial pharmacology, not casual.",
    },
    DMT: {
      effect: {
        onset: "Vaporized seconds",
        peak: "≈1–5 min",
        duration: "≈5–20 min smoked/vaped · oral with MAOI much longer",
        after: "Rapid return · integration needed",
      },
      detection: {
        blood: "Minutes–hours",
        urine: "Short / specialized",
        saliva: "Short",
        hair: "Specialized",
      },
      riskFocus: ["mind", "set", "meds", "route"],
      riskNote: "Intensity is extreme; MAOI combinations inherit ayahuasca interaction risks.",
    },
    "2C-B": {
      effect: {
        onset: "≈30–90 min",
        peak: "≈1.5–3 h",
        duration: "≈4–8 h",
        after: "Stimulant-ish residue possible",
      },
      detection: {
        blood: "Not standardized",
        urine: "Often missed on standard panels",
        saliva: "Not standardized",
        hair: "Not standardized",
      },
      riskFocus: ["mind", "set", "hydration", "meds"],
      riskNote: "Mis-sold as MDMA/LSD often — dose and identity uncertainty raise overshoot risk.",
    },
    "Mescaline (Peyote / San Pedro)": {
      effect: {
        onset: "≈1–2 h",
        peak: "≈3–5 h",
        duration: "≈8–12+ h",
        after: "Long fatigue / integration",
      },
      detection: {
        blood: "Hours–≈1 day",
        urine: "≈1–3 days (specialized)",
        saliva: "Short",
        hair: "Specialized",
      },
      riskFocus: ["mind", "set", "conditions", "meds"],
      riskNote: "Long duration + nausea. Conservation/legal status of peyote is a separate ethical layer.",
    },
    "Morning glory": {
      effect: {
        onset: "≈30–120 min (LSA)",
        peak: "Variable",
        duration: "≈4–8 h",
        after: "Nausea / body load common",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["mind", "set", "conditions"],
      riskNote: "Seeds are often treated with fungicides — chemical risk beyond LSA.",
    },
    Datura: {
      effect: {
        onset: "≈30–60 min",
        peak: "Unpredictable",
        duration: "Many hours to >24 h",
        after: "Amnesia / delirium can be prolonged",
      },
      detection: {
        blood: "Specialized (atropine/scopolamine)",
        urine: "Specialized",
        saliva: "Specialized",
        hair: "Specialized",
        note: "Not a standard workplace panel — medical emergency risk is the point.",
      },
      riskFocus: ["mind", "set", "conditions", "metabolism"],
      riskNote: "True delirium — not a recreational psychedelic. Anticholinergic poisoning can kill.",
    },
    "Fly agaric": {
      effect: {
        onset: "≈30–90 min",
        peak: "Variable",
        duration: "≈4–8 h",
        after: "Nausea / dissociation",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["mind", "set", "conditions", "metabolism"],
      riskNote: "Muscimol/ibotenic acid content varies by mushroom — poisoning risk is real.",
    },
    "Poison hemlock": {
      effect: {
        onset: "Rapid with sufficient dose",
        peak: "Toxic emergency",
        duration: "Medical emergency timeline",
        after: "Can be fatal — not a duration chart for use",
      },
      detection: {
        blood: "Forensic / clinical only",
        urine: "Forensic / clinical only",
        saliva: "N/A",
        hair: "N/A",
        note: "Listed so it is never mistaken for food or medicine.",
      },
      riskFocus: ["conditions", "set"],
      riskNote: "Respiratory paralysis poison — there is no informed recreational use case.",
    },
    "Synthetic cannabinoids (K2/Spice)": {
      effect: {
        onset: "Minutes",
        peak: "Unpredictable / often intense",
        duration: "≈1–4 h — analogs vary",
        after: "Agitation / rebound anxiety",
      },
      detection: {
        blood: "Specialized",
        urine: "Many missed on THC screens",
        saliva: "Specialized",
        hair: "Specialized",
        note: "A negative THC test does not clear synthetic cannabinoids.",
      },
      riskFocus: ["mind", "conditions", "metabolism", "set"],
      riskNote: "Receptor potency far above cannabis — seizures, kidney injury, psychosis reports.",
    },
    Coffee: caffeineSoft("Coffee"),
    Tea: caffeineSoft("Tea"),
    "Yerba mate": caffeineSoft("Yerba mate"),
    Guarana: caffeineSoft("Guarana"),
    "Cacao / Chocolate": caffeineSoft("Cacao / Chocolate"),
    "Nicotine / Tobacco": {
      effect: {
        onset: "Seconds–minutes (route)",
        peak: "Minutes",
        duration: "≈1–2 h per use · craving longer",
        after: "Withdrawal irritability if dependent",
      },
      detection: {
        blood: "≈1–3 days (cotinine)",
        urine: "≈3–4 days cotinine (chronic longer)",
        saliva: "≈1–4 days",
        hair: "≈90 days",
      },
      riskFocus: ["conditions", "tolerance", "route", "meds"],
      riskNote: "Cardiovascular risk and pregnancy risk dominate — dependence is pharmacological.",
    },
    "Coca leaf": {
      effect: {
        onset: "Chew/tea slower than cocaine isolate",
        peak: "Mild stimulant hours",
        duration: "≈1–3 h mild",
        after: "Minimal vs isolate",
      },
      detection: {
        blood: "May show cocaine metabolites depending on amount/test",
        urine: "Possible cocaine-metabolite positives with enough leaf",
        saliva: "Possible",
        hair: "Possible",
        note: "Leaf ≠ isolate in effect — but some tests look for the same metabolites.",
      },
      riskFocus: ["conditions", "meds", "metabolism"],
      riskNote: "Refined cocaine is a different risk class than traditional leaf use.",
    },
    Khat: {
      effect: {
        onset: "Chew ≈15–30 min",
        peak: "≈1–2 h",
        duration: "≈2–4 h",
        after: "Insomnia / irritability",
      },
      detection: {
        blood: "Specialized (cathinone/cathine)",
        urine: "Specialized — may resemble amphetamine class on some tests",
        saliva: "Specialized",
        hair: "Specialized",
      },
      riskFocus: ["conditions", "mind", "hydration", "meds"],
      riskNote: "Stimulant cardiovascular load; fresh leaf potency varies.",
    },
    Ephedra: {
      effect: {
        onset: "≈30–60 min oral",
        peak: "≈1–2 h",
        duration: "≈3–5 h",
        after: "Jitters / insomnia",
      },
      detection: {
        blood: "Specialized",
        urine: "Specialized / stimulant screens may flag related compounds",
        saliva: "Specialized",
        hair: "Specialized",
      },
      riskFocus: ["conditions", "meds", "hydration"],
      riskNote: "Ephedrine-like cardiac strain — banned in many supplement contexts for a reason.",
    },
    "Betel nut": {
      effect: {
        onset: "Minutes when chewed",
        peak: "≈15–60 min",
        duration: "≈1–3 h",
        after: "Staining / dependence with chronic use",
      },
      detection: {
        blood: "Not routine workplace",
        urine: "Not routine workplace",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["conditions", "tolerance", "route"],
      riskNote: "Oral cancer risk with chronic areca nut use is the primary long-term harm signal.",
    },
    "Amyl nitrite (poppers)": {
      effect: {
        onset: "Seconds inhaled",
        peak: "Seconds",
        duration: "≈1–3 min",
        after: "Headache / BP rebound",
      },
      detection: {
        blood: "Minutes",
        urine: "Not typical drug panel",
        saliva: "Not typical",
        hair: "Not typical",
      },
      riskFocus: ["conditions", "meds", "route"],
      riskNote: "Dangerous BP drop with erectile-dysfunction meds (nitrates). Methemoglobinemia risk with some nitrites.",
    },
    Acetaminophen: {
      effect: {
        onset: "≈30–60 min pain relief",
        peak: "≈1–2 h",
        duration: "≈4–6 h",
        after: "Liver injury is delayed — hours after overdose",
      },
      detection: {
        blood: "Clinical acetaminophen level (ER use)",
        urine: "Not a recreational drug screen target",
        saliva: "N/A",
        hair: "N/A",
        note: "Detection here means clinical overdose management, not workplace drug testing.",
      },
      riskFocus: ["conditions", "meds", "metabolism"],
      riskNote: "Alcohol + acetaminophen and stacked cold meds cause delayed liver failure — a leading OTC overdose.",
    },
    Sugar: {
      effect: {
        onset: "Minutes",
        peak: "≈15–45 min",
        duration: "≈1–2 h glycemic swing",
        after: "Crash / hunger",
      },
      detection: {
        blood: "Glucose (clinical)",
        urine: "Glucose (clinical)",
        saliva: "N/A",
        hair: "N/A",
        note: "Not a toxicology panel item — metabolic health context only.",
      },
      riskFocus: ["conditions", "body"],
      riskNote: "Diabetes and metabolic syndrome change risk — not a intoxicant duration chart.",
    },
    Nutmeg: {
      effect: {
        onset: "≈2–4 h (very delayed)",
        peak: "≈6–8 h",
        duration: "≈12–24+ h",
        after: "Hangover / delirium residue",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["mind", "set", "metabolism", "conditions"],
      riskNote: "Delayed onset causes redosing into toxic anticholinergic/deliriant territory.",
    },
    Kava: {
      effect: {
        onset: "≈20–40 min",
        peak: "≈1–2 h",
        duration: "≈2–4 h",
        after: "Relaxation residue",
      },
      detection: {
        blood: "Not routine toxicology",
        urine: "Not routine workplace",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["meds", "conditions", "metabolism"],
      riskNote: "Liver-risk reports with some preparations; alcohol combinations add depressant load.",
    },
    Valerian: {
      effect: {
        onset: "≈30–60 min",
        peak: "≈1–2 h",
        duration: "≈2–4 h",
        after: "Morning grogginess possible",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["meds", "conditions"],
      riskNote: "Sedative stacking with other depressants increases impairment.",
    },
    Wormwood: {
      effect: {
        onset: "Variable (prep-dependent)",
        peak: "Variable",
        duration: "Variable",
        after: "Thujone-related toxicity at high exposure",
      },
      detection: {
        blood: "Not routine",
        urine: "Not routine",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["conditions", "metabolism", "meds"],
      riskNote: "Historical absinthe lore ≠ a dosing guide; concentrated thujone is a toxin problem.",
    },
  };

  function caffeineSoft(label) {
    return {
      effect: {
        onset: "≈15–45 min oral",
        peak: "≈30–60 min",
        duration: "≈3–5 h (half-life often ≈3–7 h)",
        after: "Insomnia / jitters if late",
      },
      detection: {
        blood: "Hours (caffeine clinical assays exist; not a drug-of-abuse panel)",
        urine: "Not a standard workplace illicit-drug target",
        saliva: "Hours",
        hair: "Not typical",
        note: label + " — stimulant load still matters for heart/anxiety even when tests ignore it.",
      },
      riskFocus: ["conditions", "meds", "hydration", "tolerance"],
      riskNote: "Stacks with other stimulants. Anxiety and arrhythmia history change the risk picture.",
    };
  }

  const BY_LINEAGE = {
    Opioid: {
      effect: {
        onset: "Minutes–≈1 h (route)",
        peak: "Route-dependent",
        duration: "Hours (agent-specific)",
        after: "Sedation / respiratory after-risk",
      },
      detection: {
        blood: "Hours–≈1–2 days",
        urine: "Often ≈2–4 days",
        saliva: "≈1–2 days",
        hair: "≈90 days",
        note: "Illicit opioids may be fentanyl — panels and naloxone planning should assume adulteration.",
      },
      riskFocus: ["meds", "tolerance", "route", "conditions", "metabolism"],
    },
    "Opioid-adjacent": {
      effect: {
        onset: "≈20–60 min oral typical",
        peak: "≈1–2 h",
        duration: "≈3–6 h",
        after: "Lethargy possible",
      },
      detection: {
        blood: "Often not routine",
        urine: "Specialized if ordered",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["meds", "tolerance", "metabolism"],
    },
    Stimulant: {
      effect: {
        onset: "Minutes–≈1 h",
        peak: "≈1–3 h",
        duration: "Hours (wide class range)",
        after: "Crash / insomnia",
      },
      detection: {
        blood: "≈1–2 days typical",
        urine: "≈2–4 days typical",
        saliva: "≈1–3 days",
        hair: "≈90 days",
      },
      riskFocus: ["conditions", "hydration", "meds", "mind", "route"],
    },
    "Sedative/Depressant": {
      effect: {
        onset: "Minutes–≈1 h",
        peak: "≈1–2 h",
        duration: "Hours to >1 day",
        after: "Residual impairment",
      },
      detection: {
        blood: "Hours–days",
        urine: "Days (drug-dependent)",
        saliva: "≈1–3 days",
        hair: "≈90 days",
      },
      riskFocus: ["meds", "tolerance", "metabolism", "conditions"],
    },
    Psychedelic: {
      effect: {
        onset: "≈20–120 min",
        peak: "≈1–4 h",
        duration: "≈4–12 h class-wide",
        after: "Afterglow / sleep debt",
      },
      detection: {
        blood: "Hours",
        urine: "Often specialized / short",
        saliva: "Short",
        hair: "Specialized",
        note: "Usually absent from basic employment panels — absence on a 5-panel is not a use guide.",
      },
      riskFocus: ["mind", "set", "meds", "conditions"],
    },
    Dissociative: {
      effect: {
        onset: "Seconds–≈1 h",
        peak: "Variable",
        duration: "Minutes–hours",
        after: "Disorientation",
      },
      detection: {
        blood: "Hours–≈1–2 days",
        urine: "≈1–4 days typical when tested",
        saliva: "≈1–2 days",
        hair: "≈90 days when tested",
      },
      riskFocus: ["set", "mind", "route", "meds"],
    },
    Cannabinoid: {
      effect: {
        onset: "Minutes–≈2 h (route)",
        peak: "Route-dependent",
        duration: "Hours",
        after: "Fog possible",
      },
      detection: {
        blood: "Days",
        urine: "Days–weeks",
        saliva: "≈1–3 days",
        hair: "≈90 days",
      },
      riskFocus: ["body", "tolerance", "mind", "route"],
    },
    Inhalant: {
      effect: {
        onset: "Seconds",
        peak: "Seconds–minutes",
        duration: "Minutes",
        after: "Headache / hypoxia risk",
      },
      detection: {
        blood: "Minutes",
        urine: "Usually not targeted",
        saliva: "Usually not targeted",
        hair: "Usually not targeted",
      },
      riskFocus: ["route", "conditions", "meds", "set"],
    },
    "Deliriant nightshade": {
      effect: {
        onset: "≈30–90 min",
        peak: "Unpredictable",
        duration: "Many hours",
        after: "Amnesia / prolonged delirium",
      },
      detection: {
        blood: "Specialized",
        urine: "Specialized",
        saliva: "Specialized",
        hair: "Specialized",
      },
      riskFocus: ["mind", "set", "conditions", "metabolism"],
    },
    "Adaptogen/Nervine": {
      effect: {
        onset: "≈20–60 min",
        peak: "≈1–2 h",
        duration: "≈2–4 h",
        after: "Mild residual calm or grogginess",
      },
      detection: {
        blood: "Not routine toxicology",
        urine: "Not routine workplace panels",
        saliva: "Not routine",
        hair: "Not routine",
      },
      riskFocus: ["meds", "conditions"],
    },
    Everyday: {
      effect: {
        onset: "Minutes–hours",
        peak: "Variable",
        duration: "Variable",
        after: "Context-dependent",
      },
      detection: {
        blood: "Usually clinical markers, not drug panels",
        urine: "Usually not illicit-drug targets",
        saliva: "N/A",
        hair: "N/A",
      },
      riskFocus: ["conditions", "body"],
    },
    "Everyday/OTC": {
      effect: {
        onset: "≈30–60 min",
        peak: "≈1–2 h",
        duration: "≈4–6 h",
        after: "Drug-specific",
      },
      detection: {
        blood: "Clinical levels when relevant",
        urine: "Usually not workplace illicit panels",
        saliva: "N/A",
        hair: "N/A",
      },
      riskFocus: ["meds", "conditions", "metabolism"],
    },
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolve(d) {
    const named = BY_NAME[d.name];
    const lineage = BY_LINEAGE[d.lineage] || BY_LINEAGE.Everyday;
    return {
      effect: (named && named.effect) || lineage.effect,
      detection: (named && named.detection) || lineage.detection,
      riskFocus: (named && named.riskFocus) || lineage.riskFocus || ["metabolism", "meds", "set", "route"],
      riskNote: (named && named.riskNote) || lineage.riskNote || "",
    };
  }

  function row(label, value) {
    return `<div class="tb-row"><span class="tb-k">${esc(label)}</span><span class="tb-v">${esc(value)}</span></div>`;
  }

  function timeBodyHtml(d) {
    const r = resolve(d);
    const e = r.effect;
    const det = r.detection;
    return `<div class="sec timebody">
      <div class="lbl"><span class="num">4</span>Time in Body</div>
      <p class="tb-frame">${esc(FRAME_TIME)}</p>
      <div class="tb-block">
        <h4>Effect duration</h4>
        ${row("Onset", e.onset)}
        ${row("Peak", e.peak)}
        ${row("Duration", e.duration)}
        ${row("After-effects", e.after)}
      </div>
      <div class="tb-block">
        <h4>Detection windows</h4>
        <p class="tb-why">Shown so you can choose whether to partake when testing is a real stake (job, etc). Not a guide to evade or time a test.</p>
        ${row("Blood", det.blood)}
        ${row("Urine", det.urine)}
        ${row("Saliva", det.saliva)}
        ${row("Hair", det.hair)}
        ${det.note ? `<p class="tb-note">${esc(det.note)}</p>` : ""}
      </div>
      <p class="tb-src">${esc(SOURCES)}</p>
    </div>`;
  }

  function riskModsHtml(d) {
    const r = resolve(d);
    const focus = new Set(r.riskFocus || []);
    const chips = RISK_FACTORS.map((f) => {
      const on = focus.has(f.id);
      return `<div class="rm-card${on ? " on" : ""}"><h4>${esc(f.title)}</h4><p>${esc(f.how)}</p></div>`;
    }).join("");
    return `<div class="sec riskmods">
      <div class="lbl"><span class="num">5</span>Why you may differ</div>
      <p class="tb-frame">${esc(FRAME_RISK)}</p>
      ${r.riskNote ? `<p class="rm-note">${esc(r.riskNote)}</p>` : ""}
      <div class="rm-grid">${chips}</div>
      <p class="tb-src">Highlighted cards are especially relevant for this substance — all can still apply.</p>
    </div>`;
  }

  function disclaimerHtml() {
    return `<div class="sec adyton-disclaimer"><p>${esc(DISCLAIMER)}</p></div>`;
  }

  global.adytonTimeBodyHtml = timeBodyHtml;
  global.adytonRiskModsHtml = riskModsHtml;
  global.adytonDisclaimerHtml = disclaimerHtml;
  global.ADYTON_HR_DISCLAIMER = DISCLAIMER;
})(typeof window !== "undefined" ? window : globalThis);

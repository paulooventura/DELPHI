export type Insight = {
  model: string;
  text: string;
  confidence: number;
};

export type Compass = {
  north: string;
  east: string;
  south: string;
  west: string;
};

export type CalendarItem = {
  time: string;
  title: string;
  detail: string;
};

export type ProwlerResult = {
  query: string;
  insights: Insight[];
  confidence: number;
  mode: string;
  orchestration: {
    taskCount: number;
  };
  answer: string;
  nextActions: string[];
  compass: Compass;
  calendar: CalendarItem[];
};

function makeTimeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildAnswer(query: string): { answer: string; nextActions: string[] } {
  const q = query.toLowerCase();
  const wantsUi = /ui|design|layout|clean|fast|frontend/.test(q);
  const wantsPlanner = /plan|roadmap|proceed|next|steps|productivity/.test(q);
  const wantsCalendarCompass = /calendar|compass/.test(q);

  const nextActions = [
    "Lock the core workflow: query, run, save, review.",
    "Implement calendar and compass widgets as first-class productivity panels.",
    "Add one-click prompt templates for recurring research tasks.",
    "Measure response clarity and reduce output noise in each iteration.",
  ];

  if (wantsUi) {
    nextActions.unshift("Refine spacing, typography, and hierarchy for scan-friendly output.");
  }

  if (wantsPlanner) {
    nextActions.unshift("Follow a tight 30-minute execution cycle with visible milestones.");
  }

  if (wantsCalendarCompass) {
    nextActions.unshift("Keep calendar and compass always visible beside the answer.");
  }

  const answer = [
    "Best way forward: operate as a local-first productivity loop.",
    "Ship focused improvements in short cycles, then publish every 10 minutes to keep cloud and local aligned.",
    "Use the compass to stay directionally correct and the calendar to sequence immediate execution blocks.",
  ].join(" ");

  return { answer, nextActions: nextActions.slice(0, 5) };
}

export async function runProwler(query: string): Promise<ProwlerResult> {
  const now = new Date();
  const plan = buildAnswer(query);
  const taskIds = ["normalize-query", "plan-answer", "generate-insights", "build-calendar", "build-compass"];

  const models = ["Ceres", "Nova", "Astra"];

  const insights = models.map((model) => ({
    model,
    text: `${model} focus: ${plan.nextActions[Math.floor(Math.random() * plan.nextActions.length)]}`,
    confidence: 0.72 + Math.random() * 0.18,
  }));

  const confidence = insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;

  const compass: Compass = {
    north: "Outcome: clear, useful answer that drives immediate action.",
    east: "Execution: implement one small feature set per cycle.",
    south: "Stability: keep local mode reliable and lightweight.",
    west: "Reflection: review results and tighten the next prompt.",
  };

  const calendar: CalendarItem[] = [
    {
      time: makeTimeLabel(now),
      title: "Cycle Start",
      detail: "Define scope and run first query.",
    },
    {
      time: makeTimeLabel(addMinutes(now, 10)),
      title: "Implement",
      detail: "Apply one UI and one logic improvement.",
    },
    {
      time: makeTimeLabel(addMinutes(now, 20)),
      title: "Validate",
      detail: "Run checks and review output quality.",
    },
    {
      time: makeTimeLabel(addMinutes(now, 30)),
      title: "Sync",
      detail: "Push and deploy, then start next cycle.",
    },
  ];

  return {
    query,
    insights,
    confidence,
    mode: "v7-free-local",
    orchestration: {
      taskCount: taskIds.length,
    },
    answer: plan.answer,
    nextActions: plan.nextActions,
    compass,
    calendar,
  };
}

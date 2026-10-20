import {
  type Data,
  type Entry,
  type Transaction,
  type Goal,
  budget,
  balances,
  mainGoal,
  remaining,
  splitPool,
  recordPayday,
  completeQuests,
  validate,
  id,
  today,
  validDate,
  MAX_CENTS,
} from "./model";

/** Shares of money left after tithing and planned expenses. */
export interface IncomeSplit {
  main: number;
  fun: number;
  quests: Record<string, number>;
}
export function incomeQuests(data: Data): Goal[] {
  const b = balances(data);
  return data.goals
    .filter(
      (g) =>
        g.type === "side" &&
        !g.deleted &&
        g.status !== "archived" &&
        g.status !== "completed" &&
        remaining(g, b[g.id]) > 0,
    )
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}
export function incomeSplitFromPlan(data: Data): IncomeSplit {
  const quests: Record<string, number> = {};
  let sideTotal = 0;
  for (const g of incomeQuests(data)) {
    const share =
      data.settings.mode === "balanced" && g.status === "active"
        ? (data.settings.savings * g.allocation) / 100
        : 0;
    quests[g.id] = share;
    sideTotal += share;
  }
  return {
    main: Math.max(0, data.settings.savings - sideTotal),
    fun: 100 - data.settings.savings,
    quests,
  };
}
export function exampleIncomeSplit(data: Data): IncomeSplit {
  const available = incomeQuests(data);
  if (!available.length)
    throw Error("Add a Side Quest to use the 50 / 30 / 20 split.");
  const funded = available.filter(
    (g) => g.status === "active" && g.allocation > 0,
  );
  const selected = funded.length ? funded : [available[0]];
  const totalWeight = selected.reduce((sum, g) => sum + (g.allocation || 1), 0);
  const quests = Object.fromEntries(available.map((g) => [g.id, 0]));
  let left = 30;
  selected.forEach((g, i) => {
    const share =
      i === selected.length - 1
        ? left
        : Math.round(((30 * (g.allocation || 1)) / totalWeight) * 100) / 100;
    quests[g.id] = share;
    left -= share;
  });
  return { main: 50, fun: 20, quests };
}
export function dataWithIncomeSplit(data: Data, split: IncomeSplit): Data {
  if (!mainGoal(data))
    throw Error("Create your main goal before recording income.");
  const eligible = new Set(incomeQuests(data).map((g) => g.id));
  const shares = [split.main, split.fun, ...Object.values(split.quests)];
  if (shares.some((n) => !Number.isFinite(n) || n < 0 || n > 100))
    throw Error("Each percentage must be between 0% and 100%.");
  if (Object.keys(split.quests).some((goalId) => !eligible.has(goalId)))
    throw Error(
      "Your goals changed. Reopen Record income to use the latest goals.",
    );
  const total = shares.reduce((sum, n) => sum + n, 0);
  if (Math.abs(total - 100) > 0.000001)
    throw Error(
      `Your split must add up to 100% (currently ${Math.round(total * 100) / 100}%).`,
    );
  const savingShare = 100 - split.fun;
  const hasSides = Object.values(split.quests).some((n) => n > 0);
  return {
    ...data,
    settings: {
      ...data.settings,
      savings: savingShare,
      mode: hasSides ? "balanced" : "focus",
    },
    goals: data.goals.map((g) => {
      if (!eligible.has(g.id)) return g;
      const share = split.quests[g.id] || 0;
      return {
        ...g,
        allocation: savingShare > 0 ? (share / savingShare) * 100 : 0,
        status: share > 0 ? "active" : g.status,
      };
    }),
  };
}
export interface IncomeBreakdown {
  gross: number;
  tithing: number;
  expenses: number;
  available: number;
  savings: number;
  fun: number;
  entries: Entry[];
  prepared: Data;
}
export function incomeBreakdown(
  data: Data,
  gross: number,
  split = incomeSplitFromPlan(data),
): IncomeBreakdown {
  if (!Number.isSafeInteger(gross) || gross <= 0 || gross > MAX_CENTS)
    throw Error("Enter the amount you actually earned, greater than zero.");
  const prepared = dataWithIncomeSplit(data, split);
  const plan = budget(prepared.settings, gross);
  if (!plan.valid)
    throw Error(
      "This income cannot cover your planned expenses after tithing. Adjust expenses in Budget first.",
    );
  return {
    gross,
    tithing: plan.giving,
    expenses: plan.expenses,
    available: plan.available,
    savings: plan.savings,
    fun: plan.spending,
    entries: splitPool(prepared, plan.savings),
    prepared,
  };
}
export interface RecordIncomeOptions {
  split?: IncomeSplit;
  day?: string;
  note?: string;
  rememberSplit?: boolean;
  scheduledPayday?: boolean;
}
export function recordIncome(
  data: Data,
  gross: number,
  options: RecordIncomeOptions = {},
): Data {
  const day = options.day || today();
  if (!validDate(day) || day > today())
    throw Error("Choose today or an earlier date.");
  const plan = incomeBreakdown(data, gross, options.split);
  const note = (options.note || "Income recorded").trim().slice(0, 200);
  let recorded: Data;
  if (options.scheduledPayday) {
    // The schedule advances only as part of this explicitly confirmed earning.
    recorded = recordPayday(plan.prepared, day, gross);
    recorded.transactions[recorded.transactions.length - 1].note = note;
  } else {
    const receipt: Transaction = {
      id: id(),
      date: day,
      createdAt: new Date().toISOString(),
      kind: "income",
      note,
      entries: plan.entries,
      gross,
      giving: plan.tithing,
      expenses: plan.expenses,
      spending: plan.fun,
    };
    recorded = {
      ...plan.prepared,
      transactions: [...data.transactions, receipt],
    };
  }
  const next = options.rememberSplit
    ? recorded
    : {
        ...data,
        transactions: recorded.transactions,
        settings: options.scheduledPayday
          ? { ...data.settings, nextPayday: recorded.settings.nextPayday }
          : data.settings,
      };
  const b = balances(next),
    funded = new Set(plan.entries.map((e) => e.goalId));
  const completed = completeQuests({
    ...next,
    goals: next.goals.map((g) =>
      g.type === "side" && funded.has(g.id) && b[g.id] >= g.target
        ? { ...g, status: "completed" }
        : g,
    ),
  });
  return validate(completed);
}

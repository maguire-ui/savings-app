export const VERSION = 1;
export const MAX_CENTS = 99_999_999_999;
export type Frequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type GoalStatus =
  | "active"
  | "wishlist"
  | "paused"
  | "completed"
  | "archived";
export interface Settings {
  income: number;
  frequency: Frequency;
  nextPayday: string;
  firstDay: number;
  secondDay: number;
  monthlyDay: number;
  giving: number;
  savings: number;
  expenses: number;
  mode: "focus" | "balanced";
  currency: "CAD" | "USD" | "EUR" | "GBP";
  appearance: "system" | "light" | "dark";
  foodCost: number;
  foodVisits: number;
}
export interface Goal {
  id: string;
  name: string;
  target: number;
  type: "main" | "side";
  status: GoalStatus;
  allocation: number;
  priority: number;
  targetDate: string;
  icon: string;
  deleted?: boolean;
}
export interface Entry {
  goalId: string;
  amount: number;
}
export interface Transaction {
  id: string;
  date: string;
  createdAt: string;
  kind: "deposit" | "withdrawal" | "purchase" | "payday" | "opening" | "income";
  note: string;
  entries: Entry[];
  voided?: boolean;
  payday?: string;
  gross?: number;
  giving?: number;
  expenses?: number;
  spending?: number;
}
export interface Data {
  version: 1;
  revision: number;
  settings: Settings;
  goals: Goal[];
  transactions: Transaction[];
}
export const id = () => crypto.randomUUID();
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function emptyData(): Data {
  return {
    version: 1,
    revision: 0,
    settings: {
      income: 0,
      frequency: "biweekly",
      nextPayday: "",
      firstDay: 1,
      secondDay: 15,
      monthlyDay: 1,
      giving: 10,
      savings: 40,
      expenses: 0,
      mode: "focus",
      currency: "CAD",
      appearance: "system",
      foodCost: 0,
      foodVisits: 0,
    },
    goals: [],
    transactions: [],
  };
}
export function cents(value: string | number) {
  const n = Number(value);
  if (
    !String(value).trim() ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > MAX_CENTS / 100
  )
    throw Error("Enter a valid amount between $0 and $999,999,999.99.");
  return Math.round((n + Number.EPSILON) * 100);
}
export function money(n: number, currency = "CAD", compact = false) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && n % 100 === 0 ? 0 : 2,
  }).format(n / 100);
}
const percentageFormat = new Intl.NumberFormat("en-CA", {
  style: "percent",
  maximumFractionDigits: 1,
});
export function percent(n: number) {
  return Number.isFinite(n) ? percentageFormat.format(n / 100) : "—";
}
export const remaining = (g: Goal, b: number) => Math.max(0, g.target - b);
export function balances(d: Data) {
  const b: Record<string, number> = Object.fromEntries(
    d.goals.map((g) => [g.id, 0]),
  );
  for (const t of d.transactions)
    if (!t.voided)
      for (const e of t.entries) b[e.goalId] = (b[e.goalId] || 0) + e.amount;
  return b;
}
export function mainGoal(d: Data) {
  return d.goals.find(
    (g) => g.type === "main" && g.status !== "archived" && !g.deleted,
  );
}
export function budget(s: Settings, income = s.income) {
  const giving = Math.round((income * s.giving) / 100);
  const afterGiving = income - giving;
  const expenses = s.expenses;
  const available = Math.max(0, afterGiving - expenses);
  const savings = Math.round((available * s.savings) / 100);
  return {
    income,
    giving,
    afterGiving,
    expenses,
    available,
    savings,
    spending: available - savings,
    valid: expenses <= afterGiving,
  };
}
function date(s: string) {
  return new Date(`${s}T12:00:00Z`);
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(date(s).valueOf()) &&
    date(s).toISOString().slice(0, 10) === s
  );
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthDate = (y: number, m: number, day: number) =>
  new Date(
    Date.UTC(
      y,
      m,
      Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()),
      12,
    ),
  );
export function paydays(s: Settings, count: number, from = today()): string[] {
  if (!validDate(s.nextPayday) || !validDate(from) || count <= 0) return [];
  const anchor = date(s.nextPayday),
    lower = s.nextPayday > from ? s.nextPayday : from;
  if (s.frequency === "weekly" || s.frequency === "biweekly") {
    const step = s.frequency === "weekly" ? 7 : 14;
    const days = Math.round(
      (date(lower).valueOf() - anchor.valueOf()) / 86400000,
    );
    const skip = Math.max(0, Math.ceil(days / step));
    return Array.from({ length: count }, (_, i) =>
      iso(new Date(anchor.valueOf() + (skip + i) * step * 86400000)),
    );
  }
  const out: string[] = [];
  const lowerDate = date(lower);
  let m = lowerDate.getUTCMonth(),
    y = lowerDate.getUTCFullYear();
  for (let i = 0; out.length < count && i < count * 2 + 24; i++, m++) {
    const month = new Date(Date.UTC(y, m, 1, 12));
    const days =
      s.frequency === "monthly" ? [s.monthlyDay] : [s.firstDay, s.secondDay];
    for (const day of days) {
      const d = iso(
        monthDate(month.getUTCFullYear(), month.getUTCMonth(), day),
      );
      if (d >= lower && !out.includes(d)) out.push(d);
      if (out.length === count) break;
    }
  }
  return out;
}
export function splitPool(d: Data, pool: number, b = balances(d)): Entry[] {
  const main = mainGoal(d);
  if (!main) throw Error("Create a main goal first.");
  let left = pool;
  const entries: Entry[] = [];
  if (d.settings.mode === "balanced")
    for (const g of [...d.goals].sort(
      (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
    )) {
      if (g.type !== "side" || g.status !== "active" || g.deleted) continue;
      const amount = Math.min(
        left,
        remaining(g, b[g.id] || 0),
        Math.floor((pool * g.allocation) / 100),
      );
      if (amount > 0) {
        entries.push({ goalId: g.id, amount });
        left -= amount;
      }
    }
  if (left > 0) entries.push({ goalId: main.id, amount: left });
  return entries;
}
export interface Forecast {
  count: number | null;
  date: string | null;
  reason: string;
}
export function forecasts(
  d: Data,
  from = today(),
  extraPerPay = 0,
): Record<string, Forecast> {
  const out: Record<string, Forecast> = {},
    b = balances(d),
    pool = budget(d.settings).savings + extraPerPay,
    main = mainGoal(d);
  for (const g of d.goals) {
    const complete = b[g.id] >= g.target;
    out[g.id] = {
      count: complete ? 0 : null,
      date: null,
      reason: complete
        ? "Goal reached"
        : g.status !== "active" && g.type === "side"
          ? "Not receiving funding"
          : !main
            ? "Create a main goal"
            : !d.settings.income
              ? "Add your income to see a forecast"
              : !d.settings.nextPayday
                ? "Set your next payday"
                : pool <= 0
                  ? "Increase your savings allocation"
                  : g.type === "side" && d.settings.mode === "focus"
                    ? "Focus Mode funds your main goal"
                    : g.type === "side" && !g.allocation
                      ? "Set a funding allocation"
                      : "Beyond the 50-year forecast window",
    };
  }
  if (!main || pool <= 0 || !budget(d.settings).valid || !d.settings.income)
    return out;
  const dates = paydays(d.settings, 2600, from);
  const endYear = Number(from.slice(0, 4)) + 50;
  for (
    let i = 0;
    i < dates.length && Number(dates[i].slice(0, 4)) <= endYear;
    i++
  ) {
    const entries = splitPool(d, pool, b);
    for (const e of entries) b[e.goalId] += e.amount;
    for (const g of d.goals)
      if (out[g.id].count === null && b[g.id] >= g.target)
        out[g.id] = {
          count: i + 1,
          date: dates[i],
          reason: "Based on your current plan",
        };
    if (
      d.goals
        .filter((g) => g.type === "main" || g.status === "active")
        .every((g) => out[g.id].count !== null)
    )
      break;
  }
  return out;
}
export function transaction(
  d: Data,
  goalId: string,
  amount: number,
  kind: Transaction["kind"],
  note = "",
  day = today(),
): Data {
  if (
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > MAX_CENTS
  )
    throw Error("Enter an amount greater than zero.");
  const g = d.goals.find((g) => g.id === goalId && !g.deleted);
  if (!g) throw Error("Choose an available goal.");
  if (g.status === "archived")
    throw Error("Restore this goal before changing its balance.");
  if ((balances(d)[goalId] || 0) + amount < 0)
    throw Error("That is more than this goal’s saved balance.");
  if (!validDate(day) || day > today())
    throw Error("Choose today or an earlier date.");
  const next = {
    ...d,
    transactions: [
      ...d.transactions,
      {
        id: id(),
        date: day,
        createdAt: new Date().toISOString(),
        kind,
        note: note.trim().slice(0, 200),
        entries: [{ goalId, amount }],
      },
    ],
  };
  return completeQuests(next);
}
export function completeQuests(d: Data): Data {
  const b = balances(d);
  return {
    ...d,
    goals: d.goals.map((g) =>
      g.type === "side" && g.status === "active" && b[g.id] >= g.target
        ? { ...g, status: "completed" }
        : g,
    ),
  };
}
export function recordPayday(
  d: Data,
  day: string,
  gross = d.settings.income,
): Data {
  if (!validDate(day) || day > today())
    throw Error("A payday can only be recorded on or after its date.");
  if (day !== d.settings.nextPayday)
    throw Error(
      "Use your scheduled next payday. Change it in Settings if needed.",
    );
  if (d.transactions.some((t) => t.payday === day && !t.voided))
    throw Error("This payday is already recorded.");
  const plan = budget(d.settings, gross);
  if (!plan.valid) throw Error("Expenses exceed the paycheque after tithing.");
  if (gross <= 0) throw Error("Enter a paycheque amount greater than zero.");
  const entries = splitPool(d, plan.savings);
  const following = paydays(d.settings, 2, day)[1];
  const next = {
    ...d,
    settings: { ...d.settings, nextPayday: following },
    transactions: [
      ...d.transactions,
      {
        id: id(),
        date: day,
        createdAt: new Date().toISOString(),
        kind: "payday" as const,
        note: "Payday savings",
        entries,
        payday: day,
        gross,
        giving: plan.giving,
        expenses: plan.expenses,
        spending: plan.spending,
      },
    ],
  };
  return completeQuests(next);
}
export function voidTransaction(d: Data, tid: string): Data {
  const next = {
    ...d,
    transactions: d.transactions.map((t) =>
      t.id === tid ? { ...t, voided: true } : t,
    ),
  };
  if (Object.values(balances(next)).some((n) => n < 0))
    throw Error(
      "Undo later withdrawals first; this would make a balance negative.",
    );
  return next;
}
export function validate(value: unknown): Data {
  const d = value as Data;
  if (
    !d ||
    d.version !== VERSION ||
    !Array.isArray(d.goals) ||
    !Array.isArray(d.transactions) ||
    !d.settings
  )
    throw Error("This is not a supported Savings backup.");
  const s = d.settings;
  if (typeof s.nextPayday !== "string")
    throw Error("The backup contains an invalid payday setting.");
  const finite = (n: unknown, min = 0, max = MAX_CENTS) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const integer = (n: unknown) => finite(n) && Number.isSafeInteger(n);
  if (
    !integer(d.revision) ||
    !integer(s.income) ||
    !integer(s.expenses) ||
    !integer(s.foodCost) ||
    !finite(s.foodVisits, 0, 100) ||
    !finite(s.giving, 0, 100) ||
    !finite(s.savings, 0, 100)
  )
    throw Error("The backup contains invalid financial settings.");
  if (
    !["weekly", "biweekly", "semimonthly", "monthly"].includes(s.frequency) ||
    !["focus", "balanced"].includes(s.mode) ||
    !["CAD", "USD", "EUR", "GBP"].includes(s.currency) ||
    !["system", "light", "dark"].includes(s.appearance)
  )
    throw Error("The backup contains unsupported settings.");
  if (
    !Number.isInteger(s.firstDay) ||
    !Number.isInteger(s.secondDay) ||
    s.firstDay < 1 ||
    s.firstDay > 27 ||
    s.secondDay <= s.firstDay ||
    s.secondDay > 31
  )
    throw Error("Choose two different monthly paydays (first day 1–27).");
  if (!Number.isInteger(s.monthlyDay) || s.monthlyDay < 1 || s.monthlyDay > 31)
    throw Error("Choose a monthly payday from 1–31.");
  if (s.nextPayday && !validDate(s.nextPayday))
    throw Error("Enter a valid next payday.");
  if (s.nextPayday && s.frequency === "monthly") {
    const a = date(s.nextPayday);
    if (
      iso(monthDate(a.getUTCFullYear(), a.getUTCMonth(), s.monthlyDay)) !==
      s.nextPayday
    )
      throw Error("Your next payday must match the monthly payday.");
  }
  if (s.nextPayday && s.frequency === "semimonthly") {
    const a = date(s.nextPayday);
    const days = [s.firstDay, s.secondDay].map((n) =>
      iso(monthDate(a.getUTCFullYear(), a.getUTCMonth(), n)),
    );
    if (!days.includes(s.nextPayday))
      throw Error(
        "Your next payday must match one of your two monthly paydays.",
      );
  }
  if (!budget(s).valid)
    throw Error("Expenses cannot exceed income after tithing.");
  if (d.goals.length > 500 || d.transactions.length > 100000)
    throw Error("This backup exceeds the supported size.");
  const ids = new Set<string>();
  let mainCount = 0,
    allocation = 0;
  for (const g of d.goals) {
    if (
      !g ||
      typeof g.id !== "string" ||
      !g.id ||
      g.id.length > 100 ||
      (g.deleted !== undefined && typeof g.deleted !== "boolean") ||
      ids.has(g.id) ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 100 ||
      !integer(g.target) ||
      g.target <= 0 ||
      !["main", "side"].includes(g.type) ||
      !["active", "wishlist", "paused", "completed", "archived"].includes(
        g.status,
      ) ||
      !finite(g.allocation, 0, 100) ||
      !Number.isInteger(g.priority) ||
      g.priority < 1 ||
      g.priority > 3 ||
      typeof g.icon !== "string" ||
      g.icon.length > 30 ||
      typeof g.targetDate !== "string" ||
      (g.targetDate && !validDate(g.targetDate))
    )
      throw Error("The backup contains an invalid goal.");
    ids.add(g.id);
    if (g.type === "main" && g.status !== "archived" && !g.deleted) mainCount++;
    if (g.type === "side" && g.status === "active" && !g.deleted)
      allocation += g.allocation;
  }
  if (mainCount > 1) throw Error("Only one main goal can be active.");
  if (allocation > 100.00001)
    throw Error("Active Side Quest allocations cannot exceed 100% of savings.");
  const tids = new Set<string>();
  for (const t of d.transactions) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      (t.voided !== undefined && typeof t.voided !== "boolean") ||
      tids.has(t.id) ||
      !validDate(t.date) ||
      typeof t.createdAt !== "string" ||
      !Number.isFinite(Date.parse(t.createdAt)) ||
      typeof t.note !== "string" ||
      t.note.length > 200 ||
      ![
        "deposit",
        "withdrawal",
        "purchase",
        "payday",
        "opening",
        "income",
      ].includes(t.kind) ||
      !Array.isArray(t.entries) ||
      t.entries.some(
        (e) =>
          !ids.has(e.goalId) ||
          !Number.isSafeInteger(e.amount) ||
          Math.abs(e.amount) > MAX_CENTS,
      )
    )
      throw Error("The backup contains an invalid transaction.");
    if (
      (t.kind === "payday" || t.kind === "income") &&
      ((t.kind === "payday" && !validDate(t.payday || "")) ||
        ![t.gross, t.giving, t.expenses, t.spending].every(integer))
    )
      throw Error("The backup contains an invalid payday.");
    if (
      (t.kind === "payday" || t.kind === "income") &&
      (t.giving! +
        t.expenses! +
        t.spending! +
        t.entries.reduce((sum, e) => sum + e.amount, 0) !==
        t.gross ||
        t.entries.some((e) => e.amount < 0))
    )
      throw Error("The backup contains an unbalanced payday.");
    if (
      t.kind !== "payday" &&
      t.kind !== "income" &&
      (t.entries.length !== 1 ||
        t.entries.some(
          (e) =>
            e.amount === 0 ||
            (t.kind === "withdrawal" || t.kind === "purchase"
              ? e.amount > 0
              : e.amount < 0),
        ))
    )
      throw Error("The backup contains an inconsistent transaction.");
    tids.add(t.id);
  }
  if (Object.values(balances(d)).some((n) => !integer(n)))
    throw Error("The backup would create an invalid or negative balance.");
  return structuredClone(d);
}
export function foodEstimate(s: Settings) {
  const yearly = s.foodCost * s.foodVisits * 52;
  return { monthly: Math.round(yearly / 12), yearly: Math.round(yearly) };
}
export function shortDate(s: string | null, year = false) {
  if (!s) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date(s));
}

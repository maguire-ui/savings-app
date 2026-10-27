import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  balances,
  transaction,
  voidTransaction,
  validate,
  MAX_CENTS,
  type Data,
} from "../src/model";
import { recordIncome } from "../src/income";

function setup(): Data {
  const d = emptyData();
  d.settings = {
    ...d.settings,
    income: 25000,
    frequency: "biweekly",
    nextPayday: "2026-10-20",
    mode: "balanced",
  };
  d.goals = [
    {
      id: "main",
      name: "Main",
      target: 1000000,
      type: "main",
      status: "active",
      allocation: 0,
      priority: 1,
      targetDate: "",
      icon: "target",
    },
    {
      id: "side",
      name: "Side",
      target: 100000,
      type: "side",
      status: "active",
      allocation: 20,
      priority: 2,
      targetDate: "",
      icon: "game",
    },
    {
      id: "second",
      name: "Second",
      target: 100000,
      type: "side",
      status: "active",
      allocation: 10,
      priority: 3,
      targetDate: "",
      icon: "gift",
    },
  ];
  return transaction(
    d,
    "main",
    120000,
    "opening",
    "Starting balance",
    "2026-10-19",
  );
}
const last = (d: Data) => [...d.transactions].reverse().find((t) => !t.voided)!.id;

test("undoing a mistaken $1,000 income reverses every goal and allocation receipt, then $100 can be entered correctly", () => {
  const before = setup();
  const split = { main: 50, quests: { side: 20, second: 10 }, fun: 20 };
  const wrong = recordIncome(before, 100000, { split });
  const undone = voidTransaction(wrong, last(wrong));
  assert.deepEqual(balances(undone), balances(before));
  assert.deepEqual(undone.settings, before.settings);
  assert.deepEqual(undone.goals, before.goals);
  assert.deepEqual(undone.transactions[0], before.transactions[0]);
  assert.equal(undone.transactions.at(-1)!.voided, true);
  assert.equal(undone.transactions.at(-1)!.gross, 100000);
  const corrected = recordIncome(undone, 10000, { split });
  assert.deepEqual(balances(corrected), {
    main: 124500,
    side: 1800,
    second: 900,
  });
  assert.equal(corrected.transactions.at(-1)!.giving, 1000);
  assert.equal(corrected.transactions.at(-1)!.spending, 1800);
  assert.deepEqual(balances(before), { main: 120000, side: 0, second: 0 });
});

test("whole-income undo restores capped quest statuses, remembered split and the scheduled payday", () => {
  const d = setup();
  d.settings.mode = "focus";
  d.goals[1] = { ...d.goals[1], status: "wishlist", target: 5000 };
  d.goals[2] = { ...d.goals[2], status: "paused", target: 3000 };
  const n = recordIncome(d, 100000, {
    day: "2026-10-20",
    scheduledPayday: true,
    rememberSplit: true,
    split: { main: 40, quests: { side: 30, second: 20 }, fun: 10 },
  });
  assert.equal(n.goals[1].status, "completed");
  assert.equal(n.goals[2].status, "completed");
  assert.notEqual(n.settings.nextPayday, d.settings.nextPayday);
  const restored = voidTransaction(
    validate(JSON.parse(JSON.stringify(n))),
    last(n),
  );
  assert.deepEqual(restored.settings, d.settings);
  assert.deepEqual(restored.goals, d.goals);
  assert.deepEqual(balances(restored), balances(d));
});

test("undoing a manual deposit reopens a quest completed by that deposit", () => {
  const d = setup();
  d.goals[1].target = 10000;
  const n = transaction(d, "side", 10000, "deposit");
  assert.equal(n.goals[1].status, "completed");
  const undo = voidTransaction(n, last(n));
  assert.equal(undo.goals[1].status, "active");
  assert.equal(balances(undo).side, 0);
});

test("undoing a purchase or withdrawal restores only its money and preserves other goals", () => {
  const d = transaction(setup(), "side", 10000, "deposit");
  const bought = transaction(d, "side", -2500, "purchase");
  assert.deepEqual(
    balances(voidTransaction(bought, last(bought))),
    balances(d),
  );
  const removed = transaction(d, "main", -9999, "withdrawal");
  assert.deepEqual(
    balances(voidTransaction(removed, last(removed))),
    balances(d),
  );
});

test("undo targets the recorded ID regardless of date and rejects repeated or missing records", () => {
  const d = setup();
  const a = transaction(d, "main", 10000, "deposit", "First", "2026-10-20");
  const b = transaction(
    a,
    "main",
    20000,
    "deposit",
    "Backdated but entered last",
    "2026-10-18",
  );
  assert.equal(b.transactions.at(-1)!.note, "Backdated but entered last");
  const undo = voidTransaction(b, last(b));
  assert.equal(last(undo), last(a));
  assert.throws(() => voidTransaction(undo, last(b)), /already been undone/);
  assert.throws(() => voidTransaction(emptyData(), "missing"), /no longer available/);
});

test("undo preserves later goal edits and unrelated financial preferences", () => {
  const d = setup();
  d.settings.mode = "focus";
  let n = recordIncome(d, 20000, {
    day: d.settings.nextPayday,
    rememberSplit: true,
    scheduledPayday: true,
    split: { main: 60, quests: { side: 30, second: 0 }, fun: 10 },
  });
  n = {
    ...n,
    settings: {
      ...n.settings,
      savings: 70,
      giving: 15,
      appearance: "light",
      frequency: "weekly",
      nextPayday: "2026-11-01",
    },
    goals: n.goals.map((g) =>
      g.id === "main" ? { ...g, name: "Renamed", target: 2000000 } : g,
    ),
  };
  const undo = voidTransaction(n, last(n));
  assert.equal(undo.settings.savings, 70);
  assert.equal(undo.settings.giving, 15);
  assert.equal(undo.settings.appearance, "light");
  assert.equal(undo.settings.nextPayday, "2026-11-01");
  assert.equal(undo.goals[0].name, "Renamed");
  assert.equal(undo.goals[0].target, 2000000);
  assert.deepEqual(balances(undo), balances(d));
});

test("legacy records still undo all entries and reopen a crossed completion threshold", () => {
  const d = setup();
  d.goals[1].target = 5000;
  const n = recordIncome(d, 100000, {
    split: { main: 50, quests: { side: 30, second: 0 }, fun: 20 },
  });
  delete n.transactions.at(-1)!.undo;
  const undo = voidTransaction(
    validate(JSON.parse(JSON.stringify(n))),
    last(n),
  );
  assert.deepEqual(balances(undo), balances(d));
  assert.equal(undo.goals[1].status, "active");
});

test("an older undo cannot partially reverse an entry if one goal would become negative", () => {
  const d = setup();
  const n = recordIncome(d, 10000, {
    split: { main: 50, quests: { side: 30, second: 0 }, fun: 20 },
  });
  const spent = transaction(n, "side", -2000, "purchase");
  const before = structuredClone(spent);
  assert.throws(() => voidTransaction(spent, last(n)), /negative/);
  assert.deepEqual(spent, before);
  const undoPurchase = voidTransaction(spent, last(spent));
  assert.deepEqual(
    balances(voidTransaction(undoPurchase, last(n))),
    balances(d),
  );
});

test("corrupt undo metadata and undo balances exceeding the maximum are rejected", () => {
  const d = setup();
  const n = recordIncome(d, 20000, {
    rememberSplit: true,
    split: { main: 60, quests: { side: 30, second: 0 }, fun: 10 },
  });
  const bad = structuredClone(n);
  bad.transactions.at(-1)!.undo!.settings!.before.savings = NaN;
  assert.throws(() => validate(bad), /invalid undo/);
  const badGoal = structuredClone(n);
  badGoal.transactions
    .at(-1)!
    .undo!.goals.push({
      id: "missing",
      before: { status: "active", allocation: 0 },
      after: { status: "active", allocation: 0 },
    });
  assert.throws(() => validate(badGoal), /invalid undo/);
  let max = emptyData();
  max.goals = [d.goals[0]];
  max = transaction(max, "main", MAX_CENTS, "opening");
  max = transaction(max, "main", -100, "withdrawal");
  const withdrawal = last(max);
  max = transaction(max, "main", 100, "deposit");
  assert.throws(
    () => voidTransaction(max, withdrawal),
    /invalid or negative balance/,
  );
});

test("fun-only income can be undone and older completion stays complete when enough money remains", () => {
  const d = setup();
  const fun = recordIncome(d, 20000, {
    split: { main: 0, quests: { side: 0, second: 0 }, fun: 100 },
  });
  assert.equal(fun.transactions.at(-1)!.entries.length, 0);
  const undo = voidTransaction(fun, last(fun));
  assert.deepEqual(balances(undo), balances(d));
  assert.equal(undo.transactions.at(-1)!.voided, true);
  d.goals[1].target = 5000;
  const reached = transaction(d, "side", 5000, "deposit");
  const extra = transaction(reached, "side", 5000, "deposit");
  assert.equal(
    voidTransaction(extra, last(reached)).goals[1].status,
    "completed",
  );
});

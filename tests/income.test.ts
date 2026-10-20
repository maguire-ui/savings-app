import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  balances,
  validate,
  voidTransaction,
  today,
  forecasts,
  type Data,
  splitPool,
  MAX_CENTS,
} from "../src/model";
import {
  incomeSplitFromPlan,
  exampleIncomeSplit,
  incomeBreakdown,
  recordIncome,
  dataWithIncomeSplit,
} from "../src/income";
function setup(): Data {
  const d = emptyData();
  d.settings = {
    ...d.settings,
    income: 25000,
    savings: 40,
    mode: "balanced",
    nextPayday: "2026-10-23",
  };
  d.goals = [
    {
      id: "main",
      type: "main",
      name: "Main goal",
      target: 100000,
      status: "active",
      allocation: 0,
      priority: 1,
      targetDate: "",
      icon: "target",
    },
    {
      id: "side",
      type: "side",
      name: "Side Quest",
      target: 50000,
      status: "active",
      allocation: 20,
      priority: 2,
      targetDate: "",
      icon: "game",
    },
  ];
  return d;
}
test("$200 becomes $20 tithing, $90 main, $54 side, $36 fun with a 50/30/20 split", () => {
  const d = setup();
  const p = incomeBreakdown(d, 20000, exampleIncomeSplit(d));
  assert.equal(p.tithing, 2000);
  assert.equal(p.available, 18000);
  assert.equal(p.fun, 3600);
  assert.deepEqual(p.entries, [
    { goalId: "side", amount: 5400 },
    { goalId: "main", amount: 9000 },
  ]);
  assert.equal(
    p.tithing +
      p.expenses +
      p.fun +
      p.entries.reduce((s, e) => s + e.amount, 0),
    20000,
  );
});
test("preview is pure and income can be recorded without a configured payday or income expectation", () => {
  const d = setup();
  d.settings.nextPayday = "";
  d.settings.income = 0;
  const before = structuredClone(d);
  const split = exampleIncomeSplit(d);
  incomeBreakdown(d, 20000, split);
  assert.deepEqual(d, before);
  const n = recordIncome(d, 20000, { split });
  assert.deepEqual(balances(n), { main: 9000, side: 5400 });
  assert.equal(n.settings.nextPayday, "");
  assert.equal(n.settings.income, 0);
  assert.equal(n.transactions.length, 1);
  assert.equal(n.transactions[0].kind, "income");
  assert.deepEqual(d, before);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(n))), n);
});
test("splits are one-time by default, with explicit opt-in to remember them", () => {
  const d = setup();
  const split = exampleIncomeSplit(d);
  const once = recordIncome(d, 20000, { split });
  assert.deepEqual(once.settings, d.settings);
  assert.deepEqual(once.goals, d.goals);
  const remembered = recordIncome(d, 20000, { split, rememberSplit: true });
  assert.equal(remembered.settings.savings, 80);
  assert.equal(remembered.settings.mode, "balanced");
  assert.equal(remembered.goals[1].allocation, 37.5);
  assert.deepEqual(incomeBreakdown(remembered, 20000).entries, [
    { goalId: "side", amount: 5400 },
    { goalId: "main", amount: 9000 },
  ]);
});
test("current budget shares are reused without overwriting the user plan", () => {
  const d = setup();
  assert.deepEqual(incomeSplitFromPlan(d), {
    main: 32,
    fun: 60,
    quests: { side: 8 },
  });
  const p = incomeBreakdown(d, 20000);
  assert.equal(p.fun, 10800);
  assert.deepEqual(p.entries, [
    { goalId: "side", amount: 1440 },
    { goalId: "main", amount: 5760 },
  ]);
});
test("expenses are explicit and small actual earnings cannot overspend the remainder", () => {
  const d = setup();
  d.settings.expenses = 3000;
  const p = incomeBreakdown(d, 20000, exampleIncomeSplit(d));
  assert.equal(p.expenses, 3000);
  assert.equal(p.available, 15000);
  assert.equal(p.fun, 3000);
  assert.deepEqual(p.entries, [
    { goalId: "side", amount: 4500 },
    { goalId: "main", amount: 7500 },
  ]);
  assert.throws(() => incomeBreakdown(d, 1000), /cannot cover/);
});
test("completed Side Quest overflow returns to main and no cent is duplicated", () => {
  const d = setup();
  d.goals[1].target = 500;
  const split = exampleIncomeSplit(d);
  for (const gross of [1, 3, 101, 19999, 20000]) {
    const p = incomeBreakdown(d, gross, split);
    assert.equal(
      p.gross,
      p.tithing +
        p.expenses +
        p.fun +
        p.entries.reduce((s, e) => s + e.amount, 0),
    );
    assert.ok((p.entries.find((e) => e.goalId === "side")?.amount || 0) <= 500);
  }
  const n = recordIncome(d, 20000, { split });
  assert.deepEqual(balances(n), { main: 13900, side: 500 });
  assert.equal(n.goals[1].status, "completed");
});
test("fun-only income records a receipt while leaving goal balances unchanged", () => {
  const d = setup();
  const n = recordIncome(d, 20000, {
    split: { main: 0, fun: 100, quests: { side: 0 } },
  });
  assert.deepEqual(balances(n), { main: 0, side: 0 });
  assert.equal(n.transactions[0].spending, 18000);
  assert.equal(n.transactions[0].giving, 2000);
  assert.equal(n.transactions[0].entries.length, 0);
  assert.ok(validate(n));
});
test("invalid percentage totals, negative shares, invalid amounts and future dates are rejected", () => {
  const d = setup();
  for (const gross of [0, -1, NaN, Infinity, 1.5])
    assert.throws(() => incomeBreakdown(d, gross));
  assert.throws(
    () =>
      incomeBreakdown(d, 20000, { main: 50, fun: 30, quests: { side: 30 } }),
    /100%/,
  );
  assert.throws(() =>
    incomeBreakdown(d, 20000, { main: -10, fun: 80, quests: { side: 30 } }),
  );
  assert.throws(
    () =>
      incomeBreakdown(d, 20000, { main: 50, fun: 20, quests: { missing: 30 } }),
    /goals changed/,
  );
  assert.throws(
    () => recordIncome(d, 20000, { day: "2099-01-01" }),
    /earlier date/,
  );
});
test("forecasting and reopening never record expected paydays automatically", () => {
  const d = setup();
  d.settings.nextPayday = "2020-01-01";
  const before = JSON.stringify(d);
  forecasts(d);
  incomeBreakdown(d, 20000);
  validate(JSON.parse(before));
  assert.equal(JSON.stringify(d), before);
  assert.equal(d.transactions.length, 0);
});
test("scheduled payday advances only when explicitly selected and income is confirmed", () => {
  const d = setup();
  d.settings.nextPayday = today();
  const free = recordIncome(d, 20000);
  assert.equal(free.settings.nextPayday, today());
  const scheduled = recordIncome(d, 20000, { scheduledPayday: true });
  assert.notEqual(scheduled.settings.nextPayday, today());
  assert.equal(scheduled.transactions[0].payday, today());
  assert.throws(
    () =>
      recordIncome(
        {
          ...scheduled,
          settings: { ...scheduled.settings, nextPayday: today() },
        },
        20000,
        { scheduledPayday: true },
      ),
    /already recorded/,
  );
});
test("income undo reverses goal savings and keeps the receipt history", () => {
  const d = setup();
  const n = recordIncome(d, 20000, { split: exampleIncomeSplit(d) });
  const undone = voidTransaction(n, n.transactions[0].id);
  assert.deepEqual(balances(undone), { main: 0, side: 0 });
  assert.equal(undone.transactions[0].voided, true);
  assert.ok(validate(undone));
});
test("multiple quest shares are divided predictably and wishlist funding can be remembered", () => {
  const d = setup();
  d.goals.push({ ...d.goals[1], id: "second", name: "Second", allocation: 10 });
  const split = exampleIncomeSplit(d);
  assert.equal(split.quests.side, 20);
  assert.equal(split.quests.second, 10);
  assert.equal(
    Object.values(split.quests).reduce((s, n) => s + n, 0),
    30,
  );
  d.goals[1].status = "wishlist";
  d.goals[2].status = "paused";
  const n = recordIncome(d, 20000, {
    split: { main: 50, fun: 20, quests: { side: 30, second: 0 } },
    rememberSplit: true,
  });
  assert.equal(n.goals[1].status, "active");
  assert.equal(n.goals[2].status, "paused");
  assert.ok(validate(n));
});

test("a saved 60/30/10 income plan previews and records exact cents without adding money on save", () => {
  const data = setup(),
    original = structuredClone(data);
  const plan = validate(
    dataWithIncomeSplit(data, { main: 60, fun: 10, quests: { side: 30 } }),
  );
  assert.equal(plan.settings.savings, 90);
  assert.equal(plan.settings.mode, "balanced");
  assert.deepEqual(plan.transactions, original.transactions);
  assert.deepEqual(balances(plan), { main: 0, side: 0 });
  const preview = incomeBreakdown(plan, 20000);
  assert.equal(preview.tithing, 2000);
  assert.equal(preview.fun, 1800);
  assert.deepEqual(preview.entries, [
    { goalId: "side", amount: 5400 },
    { goalId: "main", amount: 10800 },
  ]);
  assert.deepEqual(balances(recordIncome(plan, 20000)), {
    main: 10800,
    side: 5400,
  });
  assert.deepEqual(data, original);
});

test("multiple typed quest shares activate selected goals and conserve one savings pool", () => {
  const data = setup();
  data.goals.push({
    ...data.goals[1],
    id: "side2",
    name: "Another quest",
    status: "paused",
  });
  const plan = validate(
    dataWithIncomeSplit(data, {
      main: 50,
      fun: 10,
      quests: { side: 15, side2: 25 },
    }),
  );
  assert.equal(plan.goals[2].status, "active");
  const preview = incomeBreakdown(plan, 20000);
  assert.deepEqual(preview.entries, [
    { goalId: "side", amount: 2700 },
    { goalId: "side2", amount: 4500 },
    { goalId: "main", amount: 9000 },
  ]);
  assert.equal(
    preview.tithing +
      preview.fun +
      preview.entries.reduce((s, e) => s + e.amount, 0),
    20000,
  );
});

test("repeating allocation fractions keep exact cents and still floor genuine fractional cents", () => {
  const data = setup();
  data.goals.forEach((g) => {
    g.target = MAX_CENTS;
  });
  data.goals[1].allocation = 100 / 3;
  for (const pool of [1, 2, 3, 100, 16200, 16201, MAX_CENTS]) {
    const entries = splitPool(data, pool);
    const side = entries.find((e) => e.goalId === "side")?.amount || 0;
    assert.equal(side, Math.floor(pool / 3), `pool ${pool}`);
    assert.equal(
      entries.reduce((s, e) => s + e.amount, 0),
      pool,
    );
  }
});

test("changing tithing and expenses still applies destination shares only to the remainder", () => {
  const data = setup();
  data.settings.giving = 20;
  data.settings.expenses = 1000;
  const plan = validate(
    dataWithIncomeSplit(data, { main: 60, fun: 10, quests: { side: 30 } }),
  );
  const preview = incomeBreakdown(plan, 20000);
  assert.equal(preview.tithing, 4000);
  assert.equal(preview.expenses, 1000);
  assert.equal(preview.available, 15000);
  assert.equal(preview.fun, 1500);
  assert.deepEqual(preview.entries, [
    { goalId: "side", amount: 4500 },
    { goalId: "main", amount: 9000 },
  ]);
});

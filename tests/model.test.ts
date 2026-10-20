import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  validate,
  budget,
  balances,
  paydays,
  forecasts,
  splitPool,
  transaction,
  recordPayday,
  voidTransaction,
  foodEstimate,
  cents,
  money,
  type Data,
} from "../src/model";
function setup(): Data {
  const d = emptyData();
  d.settings = {
    ...d.settings,
    income: 25000,
    nextPayday: "2026-10-23",
    savings: 40,
    mode: "balanced",
  };
  d.goals = [
    {
      id: "main",
      name: "Main",
      type: "main",
      target: 72000,
      status: "active",
      allocation: 0,
      priority: 1,
      targetDate: "",
      icon: "target",
    },
    {
      id: "side",
      name: "Side",
      type: "side",
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
test("giving comes first, one savings pool, expenses never exceed pay", () => {
  const d = setup();
  assert.deepEqual(budget(d.settings), {
    income: 25000,
    giving: 2500,
    afterGiving: 22500,
    expenses: 0,
    available: 22500,
    savings: 9000,
    spending: 13500,
    valid: true,
  });
  assert.deepEqual(splitPool(d, 9000), [
    { goalId: "side", amount: 1800 },
    { goalId: "main", amount: 7200 },
  ]);
  d.settings.expenses = 22501;
  assert.throws(() => validate(d), /Expenses/);
});
test("biweekly uses 14 days across months and forecast uses tenth scheduled payday", () => {
  const d = setup();
  assert.deepEqual(paydays(d.settings, 4, "2026-10-20"), [
    "2026-10-23",
    "2026-11-06",
    "2026-11-20",
    "2026-12-04",
  ]);
  assert.equal(forecasts(d, "2026-10-20").main.count, 10);
  assert.equal(forecasts(d, "2026-10-20").main.date, "2027-02-26");
});
test("weekly schedule crosses year and DST without day drift", () => {
  const d = setup();
  d.settings.frequency = "weekly";
  d.settings.nextPayday = "2026-12-25";
  assert.deepEqual(paydays(d.settings, 3, "2026-12-25"), [
    "2026-12-25",
    "2027-01-01",
    "2027-01-08",
  ]);
  d.settings.nextPayday = "2026-03-06";
  assert.deepEqual(paydays(d.settings, 3, "2026-03-06"), [
    "2026-03-06",
    "2026-03-13",
    "2026-03-20",
  ]);
});
test("monthly dates clamp leap/short months and recover original day", () => {
  const d = setup();
  d.settings.frequency = "monthly";
  d.settings.nextPayday = "2028-01-31";
  d.settings.monthlyDay = 31;
  assert.deepEqual(paydays(d.settings, 4, "2028-01-31"), [
    "2028-01-31",
    "2028-02-29",
    "2028-03-31",
    "2028-04-30",
  ]);
  d.settings.nextPayday = "2026-01-31";
  let n = recordPayday(d, "2026-01-31");
  n = recordPayday(n, "2026-02-28");
  assert.equal(n.settings.nextPayday, "2026-03-31");
});
test("twice-monthly uses calendar dates including short month end", () => {
  const d = setup();
  d.settings.frequency = "semimonthly";
  d.settings.firstDay = 15;
  d.settings.secondDay = 31;
  d.settings.nextPayday = "2026-01-15";
  assert.deepEqual(paydays(d.settings, 6, "2026-01-15"), [
    "2026-01-15",
    "2026-01-31",
    "2026-02-15",
    "2026-02-28",
    "2026-03-15",
    "2026-03-31",
  ]);
  assert.throws(
    () =>
      validate({ ...d, settings: { ...d.settings, nextPayday: "2026-01-16" } }),
    /match/,
  );
});
test("forecast skips overdue dates, completed quest funding returns to main", () => {
  const d = setup();
  d.goals[1].target = 1800;
  const f = forecasts(d, "2026-10-20");
  assert.equal(f.side.count, 1);
  assert.equal(f.main.count, 9);
  assert.equal(paydays(d.settings, 1, "2026-11-07")[0], "2026-11-20");
});
test("pool conservation holds with rounding, priorities and capped Side Quests", () => {
  const d = setup();
  d.goals[1].target = 1;
  for (const n of [1, 3, 99, 999, 9001]) {
    const e = splitPool(d, n);
    assert.equal(
      e.reduce((s, x) => s + x.amount, 0),
      n,
    );
    assert.ok((e.find((x) => x.goalId === "side")?.amount || 0) <= 1);
  }
});
test("purchasing from Side Quest never reduces main; completed items do not refill", () => {
  let d = setup();
  d = transaction(d, "main", 28000, "opening");
  d = transaction(d, "side", 50000, "deposit");
  assert.equal(d.goals[1].status, "completed");
  d = transaction(d, "side", -50000, "purchase");
  assert.deepEqual(balances(d), { main: 28000, side: 0 });
  assert.deepEqual(splitPool(d, 9000), [{ goalId: "main", amount: 9000 }]);
  assert.throws(() => transaction(d, "side", -1, "withdrawal"), /more than/);
});
test("record payday creates ledger entries once and preserves actual split", () => {
  let d = setup();
  d.settings.nextPayday = "2026-10-09";
  d = recordPayday(d, "2026-10-09");
  assert.equal(d.settings.nextPayday, "2026-10-23");
  assert.deepEqual(balances(d), { main: 7200, side: 1800 });
  assert.equal(d.transactions[0].gross, 25000);
  assert.throws(() => recordPayday(d, "2026-10-09"), /scheduled/);
  const frozen = structuredClone(d.transactions);
  d.settings.savings = 90;
  assert.deepEqual(d.transactions, frozen);
  assert.ok(validate(d));
});
test("undo retains original activity and prevents negative balances", () => {
  let d = setup();
  d = transaction(d, "main", 10000, "deposit");
  const deposit = d.transactions[0].id;
  d = transaction(d, "main", -9000, "withdrawal");
  assert.throws(() => voidTransaction(d, deposit), /negative/);
  d = voidTransaction(d, d.transactions[1].id);
  d = voidTransaction(d, deposit);
  assert.equal(d.transactions.length, 2);
  assert.equal(balances(d).main, 0);
});
test("no fake date for zero allocation, missing income, paused or focus quests", () => {
  let d = setup();
  d.settings.savings = 0;
  assert.equal(forecasts(d, "2026-10-20").main.date, null);
  assert.match(forecasts(d, "2026-10-20").main.reason, /allocation/);
  d = setup();
  d.settings.income = 0;
  assert.match(forecasts(d).main.reason, /income/);
  d = setup();
  d.settings.mode = "focus";
  assert.equal(forecasts(d).side.date, null);
  d.goals[1].status = "paused";
  assert.equal(forecasts(d).side.date, null);
});
test("50/30/20 adapted after giving allocates net 50/30/20", () => {
  const d = setup();
  d.settings.expenses = 11250;
  assert.equal(budget(d.settings).savings, 4500);
  assert.equal(budget(d.settings).spending, 6750);
});
test("fast food estimates are planning only and do not mutate ledger", () => {
  const d = setup();
  d.settings.foodCost = 1500;
  d.settings.foodVisits = 2;
  const before = JSON.stringify(d);
  assert.deepEqual(foodEstimate(d.settings), {
    monthly: 13000,
    yearly: 156000,
  });
  assert.equal(JSON.stringify(d), before);
});
test("malformed money, corrupt backups, negative ledger and excessive funding are rejected", () => {
  for (const v of ["NaN", "Infinity", "-1", ""]) assert.throws(() => cents(v));
  assert.equal(cents("0.29"), 29);
  let d = setup();
  d.goals[1].allocation = 101;
  assert.throws(() => validate(d));
  d = setup();
  d.transactions = [
    {
      id: "x",
      date: "2026-01-01",
      createdAt: new Date().toISOString(),
      kind: "withdrawal",
      note: "",
      entries: [{ goalId: "main", amount: -1 }],
    },
  ];
  assert.throws(() => validate(d), /negative/);
  assert.throws(() => validate({ version: 2 }));
  assert.throws(() =>
    validate({
      ...setup(),
      settings: { ...setup().settings, nextPayday: "2026-02-31" },
    }),
  );
});
test("preview and forecasts are pure; backups round-trip exactly", () => {
  const d = setup();
  const original = JSON.stringify(d);
  const preview = { ...d, settings: { ...d.settings, savings: 80 } };
  assert.ok(
    forecasts(preview, "2026-10-20").main.count! <
      forecasts(d, "2026-10-20").main.count!,
  );
  assert.equal(JSON.stringify(d), original);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(d))), d);
});

test("nonfinite preview values never render as NaN or Infinity", () => {
  for (const n of [NaN, Infinity, -Infinity]) assert.equal(money(n), "—");
  assert.equal(money(25000), "$250.00");
});

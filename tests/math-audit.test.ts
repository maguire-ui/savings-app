import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  budget,
  cents,
  MAX_CENTS,
  forecasts,
  foodEstimate,
  balances,
  validate,
} from "../src/model";
import {
  dataWithIncomeSplit,
  incomeBreakdown,
  recordIncome,
} from "../src/income";

function example() {
  const d = emptyData();
  d.settings = {
    ...d.settings,
    income: 20000,
    nextPayday: "2026-10-23",
    mode: "balanced",
  };
  d.goals = [
    {
      id: "main",
      name: "Main",
      type: "main",
      target: MAX_CENTS,
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
      target: MAX_CENTS,
      status: "active",
      allocation: 20,
      priority: 2,
      targetDate: "",
      icon: "game",
    },
  ];
  return d;
}
// Independent exact integer arithmetic: rates here are hundredths of one percent.
const roundedShare = (amount: number, rate: number) =>
  Number((BigInt(amount) * BigInt(rate) + 5000n) / 10000n);

test("$200 at 60/30/10 is $108/$54/$18 after 10% tithing, and $120/$60/$20 with no tithing", () => {
  for (const [giving, expected] of [
    [10, [2000, 10800, 5400, 1800]],
    [0, [0, 12000, 6000, 2000]],
    [20, [4000, 9600, 4800, 1600]],
  ] as const) {
    const d = example();
    d.settings.giving = giving;
    const plan = validate(
      dataWithIncomeSplit(d, { main: 60, quests: { side: 30 }, fun: 10 }),
    );
    const p = incomeBreakdown(plan, 20000),
      recorded = recordIncome(plan, 20000);
    const amounts = [
      p.tithing,
      p.entries.find((e) => e.goalId === "main")?.amount || 0,
      p.entries.find((e) => e.goalId === "side")?.amount || 0,
      p.fun,
    ];
    assert.deepEqual(amounts, expected);
    assert.deepEqual(balances(recorded), {
      main: expected[1],
      side: expected[2],
    });
    assert.deepEqual(plan.transactions, []);
  }
});

test("half-cent ties round up for decimal tithing, savings and entered money", () => {
  for (const [income, percentage, expected] of [
    [750, 4.6, 35],
    [1500, 2.3, 35],
    [3000, 1.15, 35],
    [5000, 0.57, 29],
    [1750, 4.6, 81],
  ]) {
    const s = emptyData().settings;
    assert.equal(budget({ ...s, giving: percentage }, income).giving, expected);
    assert.equal(
      budget({ ...s, giving: 0, savings: percentage }, income).savings,
      expected,
    );
  }
  assert.equal(cents("10.075"), 1008);
  assert.equal(cents("10.0749"), 1007);
  assert.equal(cents("1.005"), 101);
  assert.equal(cents("999999999.99"), MAX_CENTS);
});

test("20,000 varied budgets match an exact integer oracle and account for every cent", () => {
  let state = 20261020;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 20000; i++) {
    const income =
      i % 5 === 0 ? (next() % 100) + 1 : ((next() * 17) % MAX_CENTS) + 1;
    const giving = next() % 10001,
      saving = next() % 10001;
    const tithe = roundedShare(income, giving),
      after = income - tithe;
    const expenses = after ? next() % (after + 1) : 0;
    const savings = roundedShare(after - expenses, saving);
    const p = budget(
      {
        ...emptyData().settings,
        giving: giving / 100,
        savings: saving / 100,
        expenses,
      },
      income,
    );
    assert.equal(p.giving, tithe, JSON.stringify({ income, giving }));
    assert.equal(
      p.savings,
      savings,
      JSON.stringify({ income, giving, saving, expenses }),
    );
    assert.equal(p.spending, after - expenses - savings);
    assert.equal(p.giving + p.expenses + p.savings + p.spending, income);
    assert(
      p.valid &&
        [p.giving, p.savings, p.spending, p.available].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ),
    );
  }
});

test("income receipts conserve every cent across tiny/large earnings, expenses, decimal shares and capped quests", () => {
  for (const gross of [1, 2, 3, 99, 101, 750, 20000, 19999999, MAX_CENTS])
    for (const giving of [0, 0.57, 4.6, 10, 99.99, 100])
      for (const capped of [false, true]) {
        const d = example();
        d.settings.giving = giving;
        d.settings.expenses = Math.floor(
          (gross - roundedShare(gross, Math.round(giving * 100))) / 3,
        );
        if (capped) d.goals[1].target = 1;
        const p = incomeBreakdown(d, gross, {
          main: 33.33,
          quests: { side: 33.33 },
          fun: 33.34,
        });
        assert.equal(
          p.tithing +
            p.expenses +
            p.fun +
            p.entries.reduce((n, e) => n + e.amount, 0),
          gross,
        );
        assert(
          p.entries.every(
            (e) => Number.isSafeInteger(e.amount) && e.amount > 0,
          ),
        );
        if (capped)
          assert(
            (p.entries.find((e) => e.goalId === "side")?.amount || 0) <= 1,
          );
        assert(p.fun >= 0);
      }
});

test("tithing and shared funding forecasts use the tenth actual scheduled payday for every frequency", () => {
  for (const [frequency, nextPayday, expected] of [
    ["weekly", "2026-10-23", "2026-12-25"],
    ["biweekly", "2026-10-23", "2027-02-26"],
    ["semimonthly", "2026-10-15", "2027-02-28"],
    ["monthly", "2026-10-31", "2027-07-31"],
  ] as const) {
    const d = example();
    d.goals[0].target = 72000;
    d.settings = {
      ...d.settings,
      income: 25000,
      giving: 10,
      savings: 40,
      frequency,
      nextPayday,
      firstDay: 15,
      secondDay: 31,
      monthlyDay: 31,
    };
    const f = forecasts(d, "2026-10-01").main;
    assert.equal(f.count, 10, frequency);
    assert.equal(f.date, expected, frequency);
  }
});

test("fast-food monthly averages use 52 weeks divided by 12 without recording expenses", () => {
  const d = example(),
    before = structuredClone(d);
  assert.deepEqual(
    foodEstimate({ ...d.settings, foodCost: 1500, foodVisits: 2 }),
    { monthly: 13000, yearly: 156000 },
  );
  assert.deepEqual(
    foodEstimate({ ...d.settings, foodCost: 1999, foodVisits: 2.5 }),
    { monthly: 21656, yearly: 259870 },
  );
  assert.deepEqual(d, before);
});

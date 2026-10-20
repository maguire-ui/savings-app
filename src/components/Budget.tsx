import { useState } from "react";
import {
  type Data,
  type Settings,
  budget,
  forecasts,
  balances,
  splitPool,
  money,
  mainGoal,
  remaining,
  foodEstimate,
  shortDate,
} from "../model";
import {
  PageTitle,
  Section,
  Field,
  Button,
  ForecastRow,
  AmountInput,
} from "./UI";
import { type Commit, FormError } from "./Forms";
export function Budget({
  data,
  commit,
  scenarioOnly = false,
}: {
  data: Data;
  commit: Commit;
  scenarioOnly?: boolean;
}) {
  const [draft, setDraft] = useState<Settings>({ ...data.settings }),
    [error, setError] = useState(""),
    [foodCost, setFoodCost] = useState(String(data.settings.foodCost / 100)),
    [visits, setVisits] = useState(String(data.settings.foodVisits)),
    [reduced, setReduced] = useState(0);
  const p = budget(draft),
    preview = { ...data, settings: draft },
    main = mainGoal(data),
    b = balances(data),
    fc = forecasts(preview),
    currency = draft.currency;
  const changed = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const update = (key: keyof Settings, value: unknown) =>
    setDraft((s) => ({ ...s, [key]: value }));
  const allocations = main ? splitPool(preview, p.savings) : [];
  function apply() {
    if (commit({ ...data, settings: draft }, "Savings plan applied"))
      setError("");
  }
  function preset(name: string) {
    if (name === "save") setDraft((s) => ({ ...s, expenses: 0, savings: 40 }));
    if (name === "50")
      setDraft((s) => ({
        ...s,
        expenses: Math.round(budget(s).afterGiving * 0.5),
        savings: 40,
      }));
    if (name === "70")
      setDraft((s) => ({ ...s, giving: 10, expenses: 0, savings: 22.22 }));
  }
  const cost = Math.max(0, Math.min(999999999.99, Number(foodCost) || 0)),
    v = Math.max(0, Math.min(100, Number(visits) || 0));
  const food = foodEstimate({
    ...draft,
    foodCost: Math.round(cost * 100),
    foodVisits: v,
  });
  const savedWeekly = Math.round(cost * 100 * Math.min(reduced, v));
  const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[
    draft.frequency
  ];
  const extra = Math.round((savedWeekly * 52) / periods);
  const withFood = forecasts(preview, undefined, extra);
  const foodChanged =
    Math.round(cost * 100) !== data.settings.foodCost ||
    v !== data.settings.foodVisits;
  return (
    <>
      <PageTitle
        title={scenarioOnly ? "What if I saved more?" : "Your budget"}
        subtitle="A plan for each paycheque."
      />
      <div className="budget-total">
        {money(p.income, currency, true)}
        <span> / paycheque</span>
      </div>
      <div
        className="allocation-bar"
        role="img"
        aria-label="Paycheque allocation"
      >
        {[
          ["giving", p.giving],
          ["savings", p.savings],
          ["spending", p.spending],
          ["expenses", p.expenses],
        ].map(([name, amount]) => (
          <span
            key={name}
            className={`allocation-${name}`}
            style={{
              width: `${p.income ? Math.max(0, (Number(amount) / p.income) * 100) : 0}%`,
            }}
          />
        ))}
      </div>
      <div className="detail-list budget-breakdown">
        {[
          ["Giving", p.giving],
          ["Savings", p.savings],
          ["Spending", p.spending],
          ["Expenses", p.expenses],
        ].map(([label, amount]) => (
          <div key={label}>
            <span>
              <i
                className={`swatch allocation-${String(label).toLowerCase()}`}
              />
              {label}
            </span>
            <small>
              {p.income ? ((Number(amount) / p.income) * 100).toFixed(1) : 0}%
              of pay
            </small>
            <strong>{money(Number(amount), currency, true)}</strong>
          </div>
        ))}
      </div>
      <Section title="Make room for savings">
        <Field
          label={`Savings percentage · ${draft.savings}%`}
          hint={`Applies to ${money(p.available, currency)} after giving and expenses.`}
        >
          <input
            aria-label="Savings percentage"
            type="range"
            min="0"
            max="100"
            step="1"
            value={draft.savings}
            onChange={(e) => update("savings", Number(e.target.value))}
          />
        </Field>
        <div className="range-labels">
          <span>More spending</span>
          <span>More saving</span>
        </div>
        {!scenarioOnly ? (
          <div className="form-grid">
            <Field label="Giving (% of paycheque)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.giving}
                onChange={(e) => update("giving", Number(e.target.value))}
              />
            </Field>
            <Field label={`Expenses per payday (${currency})`}>
              <AmountInput
                value={String(draft.expenses / 100)}
                onChange={(value) =>
                  update(
                    "expenses",
                    Math.round(Math.max(0, Number(value) || 0) * 100),
                  )
                }
                label="Expenses per payday"
              />
            </Field>
          </div>
        ) : null}
        {!p.valid ? (
          <FormError error="Expenses exceed income after giving. Reduce expenses or update income." />
        ) : null}
        <Field label="Funding mode">
          <select
            value={draft.mode}
            onChange={(e) => update("mode", e.target.value)}
          >
            <option value="focus">Focus — all savings to my main goal</option>
            <option value="balanced">
              Balanced — fund my Side Quests, too
            </option>
          </select>
        </Field>
        {allocations.length ? (
          <div className="detail-list allocations">
            {allocations.map((e) => (
              <div key={e.goalId}>
                <span>{data.goals.find((g) => g.id === e.goalId)?.name}</span>
                <strong>{money(e.amount, currency)}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <p className="fine-print">
          One savings pool. Completed and paused Side Quests return their future
          share to your main goal.
        </p>
        {!scenarioOnly ? (
          <details className="preset-options">
            <summary>Budget starting points</summary>
            <div className="preset-row">
              <button onClick={() => preset("save")}>Save First</button>
              <button onClick={() => preset("50")}>50 / 30 / 20</button>
              <button onClick={() => preset("70")}>70 / 20 / 10</button>
            </div>
            <p className="fine-print">
              These are editable starting points. 50/30/20 splits money after
              giving into expenses, spending, and savings. 70/20/10 uses 10%
              giving, approximately 20% savings, and the rest spending. Your
              current plan is always customizable.
            </p>
          </details>
        ) : null}
      </Section>
      <Section title="Projection preview">
        {main ? (
          <>
            <ForecastRow
              left={remaining(main, b[main.id])}
              forecast={fc[main.id]}
              currency={currency}
            />
            <div className="detail-list">
              {data.goals
                .filter(
                  (g) =>
                    g.type === "side" && g.status === "active" && !g.deleted,
                )
                .map((g) => (
                  <div key={g.id}>
                    <span>{g.name}</span>
                    <strong>
                      {fc[g.id]?.date
                        ? shortDate(fc[g.id].date, true)
                        : fc[g.id]?.count === 0
                          ? "Reached"
                          : "Not funded"}
                    </strong>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p className="muted">
            Create a main goal to see your projected completion date.
          </p>
        )}
        <p className="fine-print">
          A preview only. Your settings and balances change only when you apply
          this plan.
        </p>
        <FormError error={error} />
        <div className="button-stack">
          <Button disabled={!changed || !p.valid} onClick={apply}>
            Apply plan
          </Button>
          {changed ? (
            <button
              className="text-link"
              onClick={() => setDraft({ ...data.settings })}
            >
              Discard preview
            </button>
          ) : null}
        </div>
      </Section>
      {!scenarioOnly ? (
        <Section title="The fast-food check-in">
          <p className="section-description">
            Small changes can make room for something bigger.
          </p>
          <div className="form-grid">
            <Field label={`Average visit (${currency})`}>
              <AmountInput
                value={foodCost}
                onChange={setFoodCost}
                label="Average fast-food visit"
                required={false}
              />
            </Field>
            <Field label="Visits per week">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.5"
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
              />
            </Field>
          </div>
          <div className="insight-numbers">
            <div>
              <strong>{money(food.monthly, currency, true)}</strong>
              <span>per month, on average</span>
            </div>
            <div>
              <strong>{money(food.yearly, currency, true)}</strong>
              <span>per year</span>
            </div>
          </div>
          <Field
            label={`What if you skipped ${Math.min(reduced, v)} visits a week?`}
          >
            <input
              type="range"
              min="0"
              max={v}
              step="0.5"
              value={Math.min(reduced, v)}
              onChange={(e) => setReduced(Number(e.target.value))}
              aria-label="Fewer fast-food visits"
            />
          </Field>
          <p className="insight-copy">
            That could free up{" "}
            <strong>
              {money((savedWeekly * 52) / 12, currency, true)} a month
            </strong>
            .
            {main && extra > 0 && withFood[main.id]?.date ? (
              <>
                {" "}
                Redirecting it into your current savings split could bring your
                goal to{" "}
                <strong>{shortDate(withFood[main.id].date, true)}</strong>.
              </>
            ) : null}
          </p>
          <p className="fine-print">
            Estimate: cost × visits × 52 ÷ 12. This is discretionary spending,
            not a bill or a logged expense. Redirected money is a scenario only;
            make sure it fits within your spending allowance.
          </p>
          <Button
            secondary
            disabled={!foodChanged}
            onClick={() =>
              commit(
                {
                  ...data,
                  settings: {
                    ...data.settings,
                    foodCost: Math.round(cost * 100),
                    foodVisits: v,
                  },
                },
                "Spending estimate saved",
              )
            }
          >
            Save spending estimate
          </Button>
        </Section>
      ) : null}
    </>
  );
}

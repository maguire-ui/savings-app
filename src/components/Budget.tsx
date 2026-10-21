import { useState } from "react";
import { TrendingUp, Utensils } from "lucide-react";
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
  PercentInput,
  MenuRow,
} from "./UI";
import { type Commit, FormError } from "./Forms";
export function Budget({
  data,
  commit,
  scenarioOnly = false,
  onEditSplit,
}: {
  data: Data;
  commit: Commit;
  scenarioOnly?: boolean;
  onEditSplit?: () => void;
}) {
  const [tool, setTool] = useState<"overview" | "plan" | "food">(
      scenarioOnly ? "plan" : "overview",
    ),
    [draft, setDraft] = useState<Settings>({ ...data.settings }),
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
    setDraft((s) => ({
      ...s,
      [key]:
        key === "giving" || key === "savings"
          ? Math.min(100, Math.max(0, Number(value) || 0))
          : key === "expenses"
            ? Math.min(99_999_999_999, Math.max(0, Number(value) || 0))
            : value,
    }));
  const allocations = main
    ? splitPool(preview, p.savings).sort(
        (a, b) => Number(b.goalId === main.id) - Number(a.goalId === main.id),
      )
    : [];
  function apply() {
    if (commit({ ...data, settings: draft }, "Savings plan applied"))
      setError("");
    else setError("Could not save. Reopen Budget and try again.");
  }
  function go(next: typeof tool) {
    setDraft({ ...data.settings });
    setFoodCost(String(data.settings.foodCost / 100));
    setVisits(String(data.settings.foodVisits));
    setReduced(0);
    setError("");
    setTool(next);
    window.scrollTo({ top: 0, behavior: "instant" });
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
        title={
          tool === "overview"
            ? "Budget"
            : tool === "food"
              ? "Fast food"
              : "Savings preview"
        }
        onBack={
          !scenarioOnly && tool !== "overview"
            ? () => go("overview")
            : undefined
        }
      />
      {tool === "overview" ? (
        <>
          <div className="budget-total">
            {money(p.income, currency, true)}
            <span> / payday</span>
          </div>
          <div className="detail-list budget-breakdown simple-breakdown">
            <div>
              <span>Tithing</span>
              <strong>{money(p.giving, currency)}</strong>
            </div>
            {allocations.length ? (
              allocations.map((entry) => (
                <div key={entry.goalId}>
                  <span>
                    {data.goals.find((g) => g.id === entry.goalId)?.name}
                  </span>
                  <strong>{money(entry.amount, currency)}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Savings</span>
                <strong>{money(p.savings, currency)}</strong>
              </div>
            )}
            <div>
              <span>Spending</span>
              <strong>{money(p.spending, currency)}</strong>
            </div>
            {p.expenses > 0 ? (
              <div>
                <span>Expenses</span>
                <strong>{money(p.expenses, currency)}</strong>
              </div>
            ) : null}
          </div>
          <Button onClick={onEditSplit}>Change split</Button>
          <div className="budget-tools">
            <MenuRow
              icon={<TrendingUp size={21} />}
              label="Savings preview"
              detail="Try a different plan"
              onClick={() => go("plan")}
            />
            <MenuRow
              icon={<Utensils size={21} />}
              label="Fast food"
              detail="See what you could save"
              onClick={() => go("food")}
            />
          </div>
        </>
      ) : tool === "plan" ? (
        <>
          <p className="section-description">
            {money(p.available, currency)} after tithing
            {p.expenses > 0 ? " & expenses" : ""}
          </p>
          <div className="form-grid">
            <Field label="To goals (%)">
              <PercentInput
                label="Savings percentage"
                value={draft.savings}
                onChange={(value) => update("savings", value)}
              />
            </Field>
            <Field label="Spending (%)">
              <PercentInput
                label="Spending percentage"
                value={100 - draft.savings}
                onChange={(value) => update("savings", 100 - value)}
              />
            </Field>
          </div>
          <div className="detail-list allocations">
            {allocations.map((entry) => (
              <div key={entry.goalId}>
                <span>
                  {data.goals.find((g) => g.id === entry.goalId)?.name}
                </span>
                <strong>{money(entry.amount, currency)}</strong>
              </div>
            ))}
          </div>
          <details className="compact-options budget-options">
            <summary>More options</summary>
            <Field label="Fund">
              <select
                value={draft.mode}
                onChange={(e) => update("mode", e.target.value)}
              >
                <option value="focus">Main goal only</option>
                <option value="balanced">Main + Side Quests</option>
              </select>
            </Field>
            {!scenarioOnly ? (
              <>
                <div className="form-grid">
                  <Field label="Tithing (% of pay)">
                    <PercentInput
                      label="Tithing percentage"
                      value={draft.giving}
                      onChange={(value) => update("giving", value)}
                    />
                  </Field>
                  <Field label="Expenses per payday">
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
                <p className="fine-print">Starting points</p>
                <div className="preset-row">
                  <button onClick={() => preset("save")}>Save First</button>
                  <button onClick={() => preset("50")}>50 / 30 / 20</button>
                  <button onClick={() => preset("70")}>70 / 20 / 10</button>
                </div>
                <p className="fine-print">
                  50/30/20: after tithing. 70/20/10: 10% tithing, about 20%
                  savings.
                </p>
              </>
            ) : null}
          </details>
          <Section title="Projected finish">
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
                        g.type === "side" &&
                        g.status === "active" &&
                        !g.deleted,
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
              <p className="muted">Add a main goal first.</p>
            )}
            {!p.valid ? (
              <FormError error="Expenses exceed pay after tithing." />
            ) : null}
            <FormError error={error} />
            <Button disabled={!changed || !p.valid} onClick={apply}>
              Apply plan
            </Button>
            {changed ? (
              <button
                className="text-link spaced"
                onClick={() => setDraft({ ...data.settings })}
              >
                Discard preview
              </button>
            ) : null}
          </Section>
        </>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Cost per visit">
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
                onFocus={(e) => {
                  if (e.currentTarget.value === "0") e.currentTarget.select();
                }}
                onChange={(e) =>
                  setVisits(e.target.value.replace(/^0+(?=\d)/, ""))
                }
              />
            </Field>
          </div>
          <div className="insight-numbers">
            <div>
              <strong>{money(food.monthly, currency, true)}</strong>
              <span>per month</span>
            </div>
            <div>
              <strong>{money(food.yearly, currency, true)}</strong>
              <span>per year</span>
            </div>
          </div>
          <Field label={`Skip ${Math.min(reduced, v)} visits a week`}>
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
            Save{" "}
            <strong>
              {money((savedWeekly * 52) / 12, currency, true)} a month
            </strong>
            .
            {main && extra > 0 && withFood[main.id]?.date ? (
              <>
                {" "}
                Your goal could be ready{" "}
                <strong>{shortDate(withFood[main.id].date, true)}</strong>.
              </>
            ) : null}
          </p>
          <p className="fine-print">
            Estimate only. Redirect savings from your spending money.
          </p>
          <FormError error={error} />
          <Button
            disabled={!foodChanged}
            onClick={() => {
              if (
                !commit(
                  {
                    ...data,
                    settings: {
                      ...data.settings,
                      foodCost: Math.round(cost * 100),
                      foodVisits: v,
                    },
                  },
                  "Estimate saved",
                )
              )
                setError("Could not save. Try again.");
            }}
          >
            Save estimate
          </Button>
        </>
      )}
    </>
  );
}

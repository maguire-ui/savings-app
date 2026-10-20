import { Heart, ReceiptText } from "lucide-react";
import { type Data, budget, mainGoal, money, percent } from "../model";
import {
  type IncomeSplit,
  incomeQuests,
  incomeBreakdown,
  dataWithIncomeSplit,
} from "../income";
import { PercentInput, AmountInput, GoalIcon } from "./UI";

export function SplitEditor({
  data,
  split,
  onChange,
  onTithingChange,
  expenses,
  onExpensesChange,
}: {
  data: Data;
  split: IncomeSplit;
  onChange: (split: IncomeSplit) => void;
  onTithingChange: (percentage: number) => void;
  expenses: string;
  onExpensesChange: (amount: string) => void;
}) {
  const main = mainGoal(data),
    quests = incomeQuests(data);
  const total =
    split.main +
    split.fun +
    Object.values(split.quests).reduce((a, b) => a + b, 0);
  let error = "";
  try {
    if (main) dataWithIncomeSplit(data, split);
  } catch (e) {
    error = (e as Error).message;
  }
  let plan: ReturnType<typeof incomeBreakdown> | undefined;
  if (main && data.settings.income > 0 && !error) {
    try {
      plan = incomeBreakdown(data, data.settings.income, split);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const deductions = budget(data.settings);
  const rows = [
    {
      kind: "main",
      key: "main",
      name: "Main goal savings",
      detail: main?.name || "Create your main goal first",
      icon: main?.icon || "target",
      value: split.main,
      amount: plan?.entries.find((e) => e.goalId === main?.id)?.amount || 0,
    },
    ...quests.map((g) => ({
      kind: "side",
      key: g.id,
      name: g.name,
      detail: `Side Quest${g.status !== "active" ? ` · ${g.status}` : ""}`,
      icon: g.icon,
      value: split.quests[g.id] || 0,
      amount: plan?.entries.find((e) => e.goalId === g.id)?.amount || 0,
    })),
    {
      kind: "fun",
      key: "fun",
      name: "Spending",
      detail: "Your fun money",
      icon: "shopping",
      value: split.fun,
      amount: plan?.fun || 0,
    },
  ];
  return (
    <div className="split-editor">
      <p className="section-description">
        Tithing comes from your full pay first. Divide what is left between your
        goals and spending.
      </p>
      <div className="split-income-base">
        <span>Expected pay</span>
        <strong>{money(data.settings.income, data.settings.currency)}</strong>
      </div>
      <div className="split-deductions">
        <div className="split-editor-row">
          <span className="split-editor-icon">
            <Heart size={20} strokeWidth={1.7} />
          </span>
          <span className="split-editor-name">
            <strong>Tithing</strong>
            <small>{percent(data.settings.giving)} of your full pay</small>
          </span>
          <span className="split-editor-control">
            <span className="percent-control">
              <PercentInput
                label="Tithing percentage"
                value={data.settings.giving}
                onChange={onTithingChange}
              />
              <span aria-hidden="true">%</span>
            </span>
            <small>{money(deductions.giving, data.settings.currency)}</small>
          </span>
        </div>
        <div className="split-editor-row">
          <span className="split-editor-icon">
            <ReceiptText size={20} strokeWidth={1.7} />
          </span>
          <span className="split-editor-name">
            <strong>Expenses</strong>
            <small>Amount per payday</small>
          </span>
          <span className="split-editor-control split-expense-control">
            <AmountInput
              label="Planned expenses"
              value={expenses}
              onChange={onExpensesChange}
            />
          </span>
        </div>
      </div>
      <div className="split-preview-base" aria-live="polite">
        <span>
          {money(data.settings.income, data.settings.currency)} pay −{" "}
          {money(deductions.giving, data.settings.currency)} tithing
          {deductions.expenses > 0
            ? ` − ${money(deductions.expenses, data.settings.currency)} expenses`
            : ""}
        </span>
        <strong>
          {money(deductions.available, data.settings.currency)} to divide
        </strong>
        <span>
          Savings, Side Quests and spending below are percentages of this
          amount.
        </span>
      </div>
      {main ? (
        <>
          <div className="split-editor-rows">
            {rows.map((row) => (
              <div className="split-editor-row" key={`${row.kind}:${row.key}`}>
                <span className="split-editor-icon">
                  <GoalIcon name={row.icon} />
                </span>
                <span className="split-editor-name">
                  <strong>{row.name}</strong>
                  <small>{row.detail}</small>
                  <small className="split-row-basis">
                    {percent(row.value)} of{" "}
                    {money(deductions.available, data.settings.currency)}
                  </small>
                </span>
                <span className="split-editor-control">
                  <span className="percent-control">
                    <PercentInput
                      label={`${row.kind === "side" ? "Side Quest " : ""}${row.name} percentage`}
                      value={row.value}
                      onChange={(value) =>
                        onChange(
                          row.kind === "main"
                            ? { ...split, main: value }
                            : row.kind === "fun"
                              ? { ...split, fun: value }
                              : {
                                  ...split,
                                  quests: { ...split.quests, [row.key]: value },
                                },
                        )
                      }
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                  <small>
                    {plan ? money(row.amount, data.settings.currency) : "—"}
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p
            className={`split-total ${error ? "invalid" : ""}`}
            aria-live="polite"
          >
            <span>Remaining split</span>
            <strong>{Number(total.toFixed(6))}% / 100%</strong>
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {quests.length === 0 ? (
            <p className="fine-print">
              Add a Side Quest from the Side Quests tab to give it a percentage
              here.
            </p>
          ) : null}
          <p className="fine-print">
            Completed Side Quests return extra and future funding to your main
            goal. Assigning a share funds a wishlist or paused quest when saved.
          </p>
          {plan ? (
            <p className="split-accounted">
              {money(
                plan.tithing +
                  plan.expenses +
                  plan.fun +
                  plan.entries.reduce((sum, e) => sum + e.amount, 0),
                data.settings.currency,
              )}{" "}
              of {money(plan.gross, data.settings.currency)} accounted for,
              including tithing{plan.expenses > 0 ? " and expenses" : ""}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="fine-print">
          Create your main goal on Home to divide your remaining pay.
        </p>
      )}
    </div>
  );
}

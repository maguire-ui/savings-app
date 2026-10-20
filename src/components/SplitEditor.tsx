import { type Data, budget, mainGoal, money } from "../model";
import {
  type IncomeSplit,
  incomeQuests,
  incomeBreakdown,
  dataWithIncomeSplit,
} from "../income";
import { PercentInput, GoalIcon } from "./UI";

export function SplitEditor({
  data,
  split,
  onChange,
}: {
  data: Data;
  split: IncomeSplit;
  onChange: (split: IncomeSplit) => void;
}) {
  const main = mainGoal(data),
    quests = incomeQuests(data);
  const total =
    split.main +
    split.fun +
    Object.values(split.quests).reduce((a, b) => a + b, 0);
  let error = "";
  try {
    dataWithIncomeSplit(data, split);
  } catch (e) {
    error = (e as Error).message;
  }
  let plan: ReturnType<typeof incomeBreakdown> | undefined;
  if (data.settings.income > 0 && !error) {
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
        Type the percentage for each destination. These shares divide the money
        left after tithing and expenses.
      </p>
      {data.settings.income > 0 ? (
        <div className="split-preview-base">
          <span>
            {money(data.settings.income, data.settings.currency)} expected pay
          </span>
          <span>
            − {money(deductions.giving, data.settings.currency)} tithing
            {deductions.expenses > 0
              ? ` − ${money(deductions.expenses, data.settings.currency)} expenses`
              : ""}
          </span>
          <strong>
            {money(deductions.available, data.settings.currency)} to divide
          </strong>
        </div>
      ) : (
        <p className="fine-print">
          Add an expected paycheque above to preview dollar amounts.
        </p>
      )}
      <div className="split-editor-rows">
        {rows.map((row) => (
          <div className="split-editor-row" key={`${row.kind}:${row.key}`}>
            <span className="split-editor-icon">
              <GoalIcon name={row.icon} />
            </span>
            <span className="split-editor-name">
              <strong>{row.name}</strong>
              <small>{row.detail}</small>
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
      <p className={`split-total ${error ? "invalid" : ""}`} aria-live="polite">
        <span>Total</span>
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
        A positive Side Quest share funds it when you save. Once it reaches its
        target, extra and future funding go to your main goal. This preview does
        not add money.
      </p>
    </div>
  );
}

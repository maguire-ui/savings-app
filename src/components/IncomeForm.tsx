import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Wallet } from "lucide-react";
import { type Data, cents, today, money, mainGoal, budget, percent } from "../model";
import {
  type IncomeSplit,
  type IncomeBreakdown,
  incomeQuests,
  incomeSplitFromPlan,
  exampleIncomeSplit,
  incomeBreakdown,
  recordIncome,
} from "../income";
import { Modal, Button, Field, AmountInput, GoalIcon } from "./UI";
import { type Commit, FormError } from "./Forms";
export function IncomeForm({
  data,
  commit,
  onClose,
}: {
  data: Data;
  commit: Commit;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"amount" | "split">("amount"),
    [amount, setAmount] = useState(""),
    [day, setDay] = useState(today()),
    [note, setNote] = useState(""),
    [split, setSplit] = useState<IncomeSplit>(() => incomeSplitFromPlan(data)),
    [remember, setRemember] = useState(false),
    [scheduled, setScheduled] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false),
    main = mainGoal(data),
    quests = incomeQuests(data),
    currency = data.settings.currency;
  let plan: IncomeBreakdown | null = null,
    planError = "";
  try {
    plan = incomeBreakdown(data, cents(amount), split);
  } catch (e) {
    planError = (e as Error).message;
  }
  const showSplit = (e: FormEvent) => {
    e.preventDefault();
    try {
      incomeBreakdown(data, cents(amount), split);
      setError("");
      setStep("split");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  function confirm(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    try {
      const next = recordIncome(data, cents(amount), {
        split,
        day,
        note,
        rememberSplit: remember,
        scheduledPayday: scheduled && day === data.settings.nextPayday,
      });
      if (commit(next, "Income recorded · your goals are updated")) onClose();
      else {
        saving.current = false;
        setError(
          "Could not save. Check storage or reopen this screen if another tab changed your plan.",
        );
      }
    } catch (e) {
      saving.current = false;
      setError((e as Error).message);
    }
  }
  function share(key: "main" | "fun", value: string) {
    setSplit((s) => ({
      ...s,
      [key]: Math.min(100, Math.max(0, Number(value) || 0)),
    }));
    setError("");
  }
  const actual = (goalId: string) =>
    plan?.entries.find((e) => e.goalId === goalId)?.amount || 0;
  const deduction = budget(
    data.settings,
    (() => {
      try {
        return cents(amount);
      } catch {
        return 0;
      }
    })(),
  );
  const capped = Boolean(
    plan &&
      quests.some(
        (g) =>
          actual(g.id) <
          Math.floor((plan!.available * (split.quests[g.id] || 0)) / 100),
      ),
  );
  return (
    <Modal
      title={step === "amount" ? "Record income" : "Your money, split"}
      onClose={onClose}
    >
      {step === "amount" ? (
        <form onSubmit={showSplit}>
          <p className="income-intro">
            Made some money? Give every dollar a place.
          </p>
          <Field label={`Amount earned (${currency})`}>
            <AmountInput
              label="Amount earned"
              value={amount}
              onChange={setAmount}
              min="0.01"
            />
          </Field>
          <Field label="Date earned">
            <input
              type="date"
              value={day}
              max={today()}
              required
              onInput={(e) => setDay(e.currentTarget.value)}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Paycheque, a shift, a gift…"
            />
          </Field>
          {day === data.settings.nextPayday && day <= today() ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(e) => setScheduled(e.target.checked)}
              />
              <span>
                This is my scheduled payday
                <small>Advance the next payday after I confirm.</small>
              </span>
            </label>
          ) : null}
          <FormError error={error} />
          <Button type="submit">Show my split</Button>
          <p className="fine-print">
            Nothing is added until you review and confirm. Expected paydays are
            forecasts only.
          </p>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <button
            type="button"
            className="text-link income-back"
            onClick={() => {
              setError("");
              setStep("amount");
            }}
          >
            <ArrowLeft size={15} />
            Change amount
          </button>
          <div className="income-total">
            <span>You earned</span>
            <strong>{money(cents(amount), currency, true)}</strong>
          </div>
          <div className="income-deductions">
            <div>
              <span>
                Tithing <small>{percent(data.settings.giving)} of income</small>
              </span>
              <strong>{money(deduction.giving, currency)}</strong>
            </div>
            {data.settings.expenses > 0 ? (
              <div>
                <span>Planned expenses</span>
                <strong>{money(data.settings.expenses, currency)}</strong>
              </div>
            ) : null}
          </div>
          <div className="income-split-heading">
            <h3>Where to put it</h3>
            <span>
              {money(deduction.available, currency)} after tithing
              {data.settings.expenses > 0 ? " and expenses" : ""}
            </span>
          </div>
          <div className="income-destinations">
            {main ? (
              <div className="income-destination">
                <span className="income-destination-icon">
                  <GoalIcon name={main.icon} />
                </span>
                <span className="income-destination-name">
                  <strong>{main.name}</strong>
                  <small>{percent(split.main)} · main goal</small>
                </span>
                <strong className="income-destination-amount">
                  {plan ? money(actual(main.id), currency) : "—"}
                </strong>
              </div>
            ) : null}
            {quests
              .filter((g) => (split.quests[g.id] || 0) > 0)
              .map((g) => (
                <div className="income-destination" key={g.id}>
                  <span className="income-destination-icon">
                    <GoalIcon name={g.icon} />
                  </span>
                  <span className="income-destination-name">
                    <strong>{g.name}</strong>
                    <small>
                      {percent(split.quests[g.id])} · Side Quest
                    </small>
                  </span>
                  <strong className="income-destination-amount">
                    {plan ? money(actual(g.id), currency) : "—"}
                  </strong>
                </div>
              ))}
            <div className="income-destination">
              <span className="income-destination-icon">
                <Wallet size={20} strokeWidth={1.7} />
              </span>
              <span className="income-destination-name">
                <strong>Fun money</strong>
                <small>{percent(split.fun)} · yours to enjoy</small>
              </span>
              <strong className="income-destination-amount">
                {plan ? money(plan.fun, currency) : "—"}
              </strong>
            </div>
          </div>
          {capped ? (
            <p className="fine-print">
              A Side Quest reaches its target with this income. Its extra money
              goes to your main goal.
            </p>
          ) : null}
          <p className="income-base">
            Percentages apply to the amount left after tithing
            {data.settings.expenses > 0 ? " and expenses" : ""}.
          </p>
          {quests.length ? (
            <button
              type="button"
              className="income-preset"
              onClick={() => {
                setSplit(exampleIncomeSplit(data));
                setError("");
              }}
            >
              Use 50 / 30 / 20<span>Main goal · Side Quests · fun</span>
            </button>
          ) : null}
          <details className="income-custom">
            <summary>Adjust percentages</summary>
            <div className="income-share-list">
              <Field label="Main goal (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={Math.round(split.main * 100) / 100}
                  onChange={(e) => share("main", e.target.value)}
                />
              </Field>
              {quests.map((g) => (
                <Field key={g.id} label={`${g.name} (%)`}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Math.round((split.quests[g.id] || 0) * 100) / 100}
                    onChange={(e) => {
                      setSplit((s) => ({
                        ...s,
                        quests: {
                          ...s.quests,
                          [g.id]: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        },
                      }));
                      setError("");
                    }}
                  />
                </Field>
              ))}
              <Field label="Fun money (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={Math.round(split.fun * 100) / 100}
                  onChange={(e) => share("fun", e.target.value)}
                />
              </Field>
            </div>
            <p className="fine-print">
              Add up to 100%. A positive share can fund a wishlist or paused
              Side Quest for this income.
            </p>
          </details>
          <label className="check-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              Use this split for future income
              <small>Update my budget percentages when I confirm.</small>
            </span>
          </label>
          <FormError error={error || (!plan ? planError : "")} />
          <Button type="submit" disabled={!plan}>
            <Check size={18} />
            Confirm & record income
          </Button>
          <p className="fine-print">
            A tracking record only. Set the money aside yourself; the app does
            not transfer funds.
          </p>
        </form>
      )}
    </Modal>
  );
}

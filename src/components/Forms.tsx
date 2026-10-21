import { Input } from "./Input";
import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import {
  type Data,
  type Goal,
  type GoalStatus,
  id,
  cents,
  transaction,
  today,
  balances,
  mainGoal,
  money,
  validate,
  completeQuests,
  budget,
} from "../model";
import { Modal, Button, Field, AmountInput, icons } from "./UI";
export type Commit = (d: Data, message?: string) => boolean;
export function FormError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      <AlertCircle size={17} />
      {error}
    </p>
  ) : null;
}
export function GoalForm({
  data,
  goal,
  type,
  onClose,
  commit,
}: {
  data: Data;
  goal?: Goal;
  type: "main" | "side";
  onClose: () => void;
  commit: Commit;
}) {
  const [name, setName] = useState(goal?.name || ""),
    [target, setTarget] = useState(goal ? String(goal.target / 100) : ""),
    [opening, setOpening] = useState(""),
    [status, setStatus] = useState<GoalStatus>(goal?.status || "wishlist"),
    [allocation, setAllocation] = useState(String(goal?.allocation || 0)),
    [priority, setPriority] = useState(goal?.priority || 2),
    [targetDate, setTargetDate] = useState(goal?.targetDate || ""),
    [icon, setIcon] = useState(goal?.icon || "target"),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (!name.trim()) throw Error("Give your goal a name.");
      const amount = cents(target);
      if (!amount) throw Error("The target must be greater than zero.");
      const g: Goal = {
        id: goal?.id || id(),
        name: name.trim(),
        target: amount,
        type,
        status: type === "main" ? "active" : status,
        allocation: Number(allocation),
        priority,
        targetDate,
        icon,
      };
      let next = {
        ...data,
        goals: goal
          ? data.goals.map((x) => (x.id === goal.id ? g : x))
          : [...data.goals, g],
      };
      if (!goal && opening && cents(opening) > 0)
        next = transaction(
          next,
          g.id,
          cents(opening),
          "opening",
          "Starting balance",
        );
      if (
        !goal &&
        type === "side" &&
        status === "active" &&
        data.settings.mode === "focus"
      )
        next = { ...next, settings: { ...next.settings, mode: "balanced" } };
      next = completeQuests(next);
      validate(next);
      if (commit(next, goal ? "Goal updated" : "Goal created")) onClose();
      else
        setError(
          "Could not save. Check device storage or reload if another tab changed this plan.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={
        goal
          ? "Edit goal"
          : type === "main"
            ? "Your main goal"
            : "New Side Quest"
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            placeholder={
              type === "main"
                ? "What are you saving for?"
                : "Something worth saving for"
            }
          />
        </Field>
        <div className="form-grid">
          <Field label="Target amount">
            <AmountInput
              value={target}
              onChange={setTarget}
              label="Target amount"
              min="0.01"
            />
          </Field>
          {!goal ? (
            <Field label="Already saved">
              <AmountInput
                value={opening}
                onChange={setOpening}
                label="Already saved"
                required={false}
              />
            </Field>
          ) : null}
        </div>
        {type === "side" ? (
          <>
            <Field label="Funding">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GoalStatus)}
              >
                <option value="wishlist">Wishlist</option>
                <option value="active">Fund now</option>
                <option value="paused">Paused</option>
                {goal ? <option value="completed">Completed</option> : null}
                {goal?.status === "archived" ? (
                  <option value="archived">Archived</option>
                ) : null}
              </select>
            </Field>
            {status === "active" ? (
              <Field
                label="Share of goal savings (%)"
                hint={`Of ${money(budget(data.settings).savings, data.settings.currency)} per payday.`}
              >
                <Input
                  aria-label="Share of the savings pool (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={allocation}
                  onChange={(e) =>
                    setAllocation(e.target.value.replace(/^0+(?=\d)/, ""))
                  }
                  onBlur={() => {
                    if (!allocation) setAllocation("0");
                  }}
                />
              </Field>
            ) : null}
          </>
        ) : null}
        <details className="compact-options">
          <summary>More options</summary>
          {type === "side" ? (
            <>
              <div className="form-grid">
                <Field label="Priority">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  >
                    <option value="1">High</option>
                    <option value="2">Normal</option>
                    <option value="3">Low</option>
                  </select>
                </Field>
                <Field label="Icon">
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  >
                    {Object.keys(icons).map((i) => (
                      <option key={i} value={i}>
                        {
                          {
                            target: "Goal",
                            game: "Gaming",
                            travel: "Travel",
                            gift: "Gift",
                            shopping: "Shopping",
                            audio: "Audio",
                          }[i]
                        }
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          ) : null}
          <Field label="Target date">
            <input
              type="date"
              value={targetDate}
              onInput={(e) => setTargetDate(e.currentTarget.value)}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </details>
        <FormError error={error} />
        <Button type="submit">{goal ? "Save changes" : "Create goal"}</Button>
      </form>
    </Modal>
  );
}
export function TransactionForm({
  data,
  goalId,
  onClose,
  commit,
}: {
  data: Data;
  goalId?: string;
  onClose: () => void;
  commit: Commit;
}) {
  const [selected, setSelected] = useState(goalId || mainGoal(data)?.id || ""),
    [kind, setKind] = useState<"deposit" | "withdrawal" | "purchase">(
      "deposit",
    ),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [day, setDay] = useState(today()),
    [error, setError] = useState("");
  const b = balances(data);
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const value = cents(amount);
      const next = transaction(
        data,
        selected,
        kind === "deposit" ? value : -value,
        kind,
        note,
        day,
      );
      if (
        commit(
          next,
          kind === "deposit" ? "Savings recorded" : "Balance updated",
        )
      )
        onClose();
      else
        setError(
          "Could not save. Check device storage or reload if another tab changed this plan.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Record savings" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="segmented">
          {(["deposit", "withdrawal", "purchase"] as const).map((k) => (
            <button
              type="button"
              key={k}
              className={kind === k ? "selected" : ""}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === "deposit"
                ? "Add"
                : k === "withdrawal"
                  ? "Remove"
                  : "Purchase"}
            </button>
          ))}
        </div>
        <Field label="Goal">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {data.goals
              .filter((g) => !g.deleted && g.status !== "archived")
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </Field>
        <p className="balance-hint">
          Saved here: {money(b[selected] || 0, data.settings.currency)}
        </p>
        <Field label="Amount">
          <AmountInput value={amount} onChange={setAmount} min="0.01" />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={day}
            max={today()}
            onInput={(e) => setDay(e.currentTarget.value)}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </Field>
        <Field label="Note (optional)">
          <Input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this for?"
          />
        </Field>
        <p className="fine-print">
          {kind === "deposit"
            ? "Extra savings for this goal."
            : kind === "purchase"
              ? "Spending from this goal."
              : "Remove savings from this goal."}{" "}
          Tracking only.
        </p>
        <FormError error={error} />
        <Button type="submit">
          {kind === "deposit"
            ? "Add savings"
            : kind === "purchase"
              ? "Record purchase"
              : "Remove savings"}
        </Button>
      </form>
    </Modal>
  );
}
export function Confirm({
  title,
  children,
  action,
  onClose,
  onConfirm,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-copy">{children}</p>
      <div className="button-stack">
        <Button onClick={onConfirm}>{action}</Button>
        <Button secondary onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

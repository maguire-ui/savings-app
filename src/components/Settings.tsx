import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Download,
  Upload,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  type Data,
  type Settings,
  type Frequency,
  cents,
  today,
  validate,
  money,
  mainGoal,
  validDate,
  paydays,
} from "../model";
import type { AppUpdates } from "../useAppUpdates";
import { incomeSplitFromPlan, dataWithIncomeSplit } from "../income";
import { SplitEditor } from "./SplitEditor";
import { download, PREVIOUS } from "../storage";
import { PageTitle, Section, Field, AmountInput, Button } from "./UI";
import { type Commit, FormError, Confirm } from "./Forms";
const incomeKeys = [
  "frequency",
  "nextPayday",
  "firstDay",
  "secondDay",
  "monthlyDay",
] as const;

export function SettingsPage({
  data,
  commit,
  offlineReady,
  online,
  install,
  updates,
  applyUpdate,
}: {
  data: Data;
  commit: Commit;
  offlineReady: boolean;
  online: boolean;
  install: () => void;
  updates: AppUpdates;
  applyUpdate: () => void;
}) {
  const [draft, setDraft] = useState<Settings>({ ...data.settings }),
    [income, setIncome] = useState(String(data.settings.income / 100)),
    [expenses, setExpenses] = useState(String(data.settings.expenses / 100)),
    [split, setSplit] = useState(() => incomeSplitFromPlan(data)),
    [splitChanged, setSplitChanged] = useState(false),
    [error, setError] = useState(""),
    [incomeError, setIncomeError] = useState(""),
    [incomeSaved, setIncomeSaved] = useState(false),
    [incoming, setIncoming] = useState<Data | null>(null),
    [backupLabel, setBackupLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previousData = useRef(data);
  // A saved income change must not erase an unrelated allocation draft.
  useEffect(() => {
    const previous = previousData.current;
    if (previous === data) return;
    previousData.current = data;
    setDraft(
      (current) =>
        Object.fromEntries(
          Object.entries(data.settings).map(([key, value]) => [
            key,
            current[key as keyof Settings] ===
            previous.settings[key as keyof Settings]
              ? value
              : current[key as keyof Settings],
          ]),
        ) as unknown as Settings,
    );
    setIncome((current) =>
      current === String(previous.settings.income / 100)
        ? String(data.settings.income / 100)
        : current,
    );
    setExpenses((current) =>
      current === String(previous.settings.expenses / 100)
        ? String(data.settings.expenses / 100)
        : current,
    );
    if (!splitChanged) setSplit(incomeSplitFromPlan(data));
  }, [data, splitChanged]);
  function resetDrafts(next: Data) {
    setDraft({ ...next.settings });
    setIncome(String(next.settings.income / 100));
    setExpenses(String(next.settings.expenses / 100));
    setSplit(incomeSplitFromPlan(next));
    setSplitChanged(false);
    setError("");
    setIncomeError("");
    setIncomeSaved(false);
  }
  const update = (key: keyof Settings, value: unknown) => {
    if (incomeKeys.some((k) => k === key)) {
      setIncomeError("");
      setIncomeSaved(false);
    }
    setDraft((s) => {
      let next = { ...s, [key]: value };
      if (key === "frequency" && value === "monthly" && validDate(s.nextPayday))
        next.monthlyDay = Number(s.nextPayday.slice(-2));
      if (
        ["frequency", "monthlyDay", "firstDay", "secondDay"].includes(key) &&
        validDate(next.nextPayday)
      ) {
        const validDays =
          next.frequency === "monthly"
            ? Number.isInteger(next.monthlyDay) &&
              next.monthlyDay >= 1 &&
              next.monthlyDay <= 31
            : next.frequency === "semimonthly"
              ? Number.isInteger(next.firstDay) &&
                next.firstDay >= 1 &&
                next.firstDay <= 27 &&
                Number.isInteger(next.secondDay) &&
                next.secondDay > next.firstDay &&
                next.secondDay <= 31
              : true;
        if (validDays)
          next = {
            ...next,
            nextPayday: paydays(next, 1, next.nextPayday)[0] || next.nextPayday,
          };
      }
      return next;
    });
  };
  function saveIncome() {
    try {
      const settings = { ...data.settings, income: cents(income) };
      for (const key of incomeKeys)
        Object.assign(settings, { [key]: draft[key] });
      const next = validate({ ...data, settings });
      if (commit(next, "Income saved · budget and forecasts updated")) {
        setIncome(String(settings.income / 100));
        setIncomeError("");
        setIncomeSaved(true);
      } else
        setIncomeError(
          "Could not save your income. Reopen Settings to use the latest plan.",
        );
    } catch (e) {
      setIncomeError((e as Error).message);
      setIncomeSaved(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const settings = {
        ...draft,
        income: cents(income),
        expenses: cents(expenses),
      };
      const next = splitChanged
        ? dataWithIncomeSplit({ ...data, settings }, split)
        : { ...data, settings };
      validate(next);
      if (commit(next, "Settings and income split saved")) {
        setError("");
        setIncomeError("");
        setIncomeSaved(true);
        setSplit(incomeSplitFromPlan(next));
        setSplitChanged(false);
      } else
        setError(
          "Could not save. Check device storage or reload if another tab changed this plan.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[
    draft.frequency
  ];
  let splitError = "";
  if (splitChanged) {
    try {
      dataWithIncomeSplit(data, split);
    } catch (e) {
      splitError = (e as Error).message;
    }
  }
  let previewIncome = 0,
    previewExpenses = 0,
    incomeValid = true;
  try {
    previewIncome = cents(income);
  } catch {
    incomeValid = false;
  }
  try {
    previewExpenses = cents(expenses);
  } catch {
    /* The form validates on save. */
  }
  const incomeChanged =
    !incomeValid ||
    previewIncome !== data.settings.income ||
    incomeKeys.some((key) => draft[key] !== data.settings[key]);
  const unsaved =
    !incomeValid ||
    JSON.stringify(draft) !== JSON.stringify(data.settings) ||
    !income ||
    previewIncome !== data.settings.income ||
    !expenses ||
    previewExpenses !== data.settings.expenses ||
    (splitChanged &&
      JSON.stringify(split) !== JSON.stringify(incomeSplitFromPlan(data)));
  const updateBusy =
    updates.status === "checking" || updates.status === "applying";
  const updateLabel =
    updates.status === "applying"
      ? "Updating…"
      : updates.status === "checking"
        ? "Checking…"
        : updates.needRefresh
          ? "Update now"
          : "Check for updates";
  return (
    <>
      <PageTitle title="Settings" />
      <form onSubmit={submit}>
        <Section title="Income & paydays">
          <Field
            label="Expected paycheque"
            hint="Amount for one payday. Set the frequency below to match when you are paid."
          >
            <AmountInput
              value={income}
              onChange={(value) => {
                setIncome(value);
                setIncomeError("");
                setIncomeSaved(false);
              }}
              label="Paycheque amount"
            />
          </Field>
          <Field label="Pay frequency">
            <select
              value={draft.frequency}
              onChange={(e) => update("frequency", e.target.value as Frequency)}
            >
              <option value="weekly">Weekly — every 7 days</option>
              <option value="biweekly">Biweekly — every 14 days</option>
              <option value="semimonthly">Twice monthly — two dates</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          {draft.frequency === "semimonthly" ? (
            <div className="form-grid">
              <Field label="First payday (day 1–27)">
                <input
                  type="number"
                  min="1"
                  max="27"
                  value={draft.firstDay}
                  onChange={(e) => update("firstDay", Number(e.target.value))}
                />
              </Field>
              <Field label="Second payday (day 2–31)">
                <input
                  type="number"
                  min="2"
                  max="31"
                  value={draft.secondDay}
                  onChange={(e) => update("secondDay", Number(e.target.value))}
                />
              </Field>
            </div>
          ) : null}
          {draft.frequency === "monthly" ? (
            <Field
              label="Monthly payday (day 1–31)"
              hint="For short months, days 29–31 use the last day of the month."
            >
              <input
                type="number"
                min="1"
                max="31"
                value={draft.monthlyDay}
                onChange={(e) => update("monthlyDay", Number(e.target.value))}
              />
            </Field>
          ) : null}
          <Field
            label="Next payday"
            hint="Used for forecasts. Record your actual earnings from Home."
          >
            <input
              type="date"
              value={draft.nextPayday}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setIncomeError("");
                setIncomeSaved(false);
                setDraft((s) => ({
                  ...s,
                  nextPayday: value,
                  ...(s.frequency === "monthly" && value
                    ? { monthlyDay: Number(value.slice(-2)) }
                    : {}),
                }));
              }}
              onChange={(e) => {
                const value = e.target.value;
                setIncomeError("");
                setIncomeSaved(false);
                setDraft((s) => ({
                  ...s,
                  nextPayday: value,
                  ...(s.frequency === "monthly" && value
                    ? { monthlyDay: Number(value.slice(-2)) }
                    : {}),
                }));
              }}
            />
          </Field>
          <p className="fine-print">
            {money(
              Math.round(
                (Math.max(0, Number(income) || 0) * 100 * periods) / 12,
              ),
              draft.currency,
            )}{" "}
            a month on average.
          </p>
          <FormError error={incomeError} />
          <Button onClick={saveIncome} disabled={!incomeChanged}>
            Save income
          </Button>
          <p
            className="fine-print income-save-status"
            role="status"
            aria-live="polite"
          >
            {incomeChanged
              ? "Unsaved income changes. Save to update your budget and goal dates everywhere."
              : incomeSaved
                ? "Income saved. Budget and goal dates are up to date."
                : "Your saved income is used throughout the app."}
          </p>
        </Section>
        <Section title="Your income split">
          <SplitEditor
            data={{
              ...data,
              settings: {
                ...draft,
                income: previewIncome,
                expenses: previewExpenses,
              },
            }}
            split={split}
            onChange={(value) => {
              setSplit(value);
              setSplitChanged(true);
              setError("");
            }}
            onTithingChange={(value) => update("giving", value)}
            expenses={expenses}
            onExpensesChange={setExpenses}
          />
          <p className="fine-print">
            Applies to future income. Existing balances stay the same.
          </p>
          {mainGoal(data) ? (
            <Button type="submit" disabled={Boolean(splitError)}>
              Save income split
            </Button>
          ) : null}
        </Section>
        <Section title="Preferences">
          <Field
            label="Currency"
            hint="Changes formatting only. Existing amounts are not converted."
          >
            <select
              value={draft.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              <option value="CAD">Canadian dollar · CAD</option>
              <option value="USD">US dollar · USD</option>
              <option value="EUR">Euro · EUR</option>
              <option value="GBP">British pound · GBP</option>
            </select>
          </Field>
          <Field label="Appearance">
            <select
              value={draft.appearance}
              onChange={(e) => update("appearance", e.target.value)}
            >
              <option value="system">Match your iPhone</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <FormError error={error} />
          <Button type="submit" disabled={Boolean(splitError)}>
            Save settings
          </Button>
        </Section>
      </form>
      <Section title="App updates">
        <div className="status-row">
          <RefreshCw size={21} />
          <div>
            <strong>Savings {__APP_VERSION__}</strong>
            <small role="status" aria-live="polite">
              {updates.status === "applying"
                ? "Opening the update…"
                : updates.status === "checking"
                  ? "Checking for updates…"
                  : updates.status === "error" || updates.status === "offline"
                    ? updates.message
                    : updates.needRefresh
                      ? "An update is ready. Your saved plan stays here."
                      : updates.status === "current"
                        ? "You’re up to date."
                        : updates.message ||
                          "Updates install here. Keep your Home Screen app."}
            </small>
          </div>
        </div>
        {updates.needRefresh && unsaved ? (
          <p className="fine-print">Save your settings before updating.</p>
        ) : null}
        <Button
          secondary={!updates.needRefresh}
          disabled={updateBusy || (updates.needRefresh && unsaved)}
          onClick={() =>
            updates.needRefresh ? applyUpdate() : void updates.checkForUpdates()
          }
        >
          {updateLabel}
        </Button>
      </Section>
      <Section title="On your iPhone">
        <div className="status-row">
          <Smartphone size={21} />
          <div>
            <strong>
              {offlineReady
                ? "Ready to use offline"
                : "Preparing offline access"}
            </strong>
            <small>
              {online ? "Online" : "You’re offline"}
              {!offlineReady ? " · Connect to download the app." : ""}
            </small>
          </div>
          {offlineReady ? <CheckCircle2 size={19} /> : null}
        </div>
        <Button secondary onClick={install}>
          Home Screen instructions
        </Button>
      </Section>
      <Section title="Your data">
        <div className="status-row">
          <ShieldCheck size={21} />
          <div>
            <strong>Saved on this device</strong>
            <small>
              Your saved plan stays here between visits and app updates.
            </small>
          </div>
        </div>
        <p className="fine-print">
          Keep a backup before switching devices, moving from Safari to the Home
          Screen app, or clearing website data. There’s no cloud sync.
        </p>
        <div className="button-stack">
          <Button
            secondary
            onClick={() => {
              download(
                JSON.stringify(data, null, 2),
                `savings-backup-${today()}.json`,
              );
              setBackupLabel("Backup download requested. Save it in Files.");
            }}
          >
            <Download size={17} />
            Export backup
          </Button>
          <Button secondary onClick={() => fileRef.current?.click()}>
            <Upload size={17} />
            Restore a backup
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Import Savings backup"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 5_000_000)
                throw Error("Choose a backup smaller than 5 MB.");
              setIncoming(validate(JSON.parse(await file.text())));
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = "";
          }}
        />
        <button
          className="text-link spaced"
          onClick={() => {
            try {
              const raw = localStorage.getItem(PREVIOUS);
              if (!raw) throw Error("There is no previous save yet.");
              setIncoming(validate(JSON.parse(raw)));
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          Recover previous save
        </button>
        {backupLabel ? (
          <p className="success-note" role="status">
            {backupLabel}
          </p>
        ) : null}
      </Section>
      {incoming ? (
        <Confirm
          title="Restore this backup?"
          action="Restore backup"
          onClose={() => setIncoming(null)}
          onConfirm={() => {
            download(
              JSON.stringify(data, null, 2),
              `savings-before-restore-${today()}.json`,
            );
            if (
              commit(
                { ...incoming, revision: data.revision },
                "Backup restored",
              )
            ) {
              resetDrafts(incoming);
              setIncoming(null);
            }
          }}
        >
          This replaces the plan on this device with {incoming.goals.length}{" "}
          goals and {incoming.transactions.length} activity records. Your
          current plan will download as a safety backup first.
        </Confirm>
      ) : null}
    </>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Download,
  Upload,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Wallet,
  SlidersHorizontal,
  SunMoon,
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
import { PageTitle, Field, AmountInput, Button, MenuRow } from "./UI";
import { type Commit, FormError, Confirm } from "./Forms";
const incomeKeys = [
  "frequency",
  "nextPayday",
  "firstDay",
  "secondDay",
  "monthlyDay",
] as const;

export type SettingsView =
  "menu" | "income" | "split" | "display" | "backups" | "updates";

export function SettingsPage({
  data,
  commit,
  offlineReady,
  online,
  install,
  updates,
  applyUpdate,
  view,
  onViewChange,
}: {
  data: Data;
  commit: Commit;
  offlineReady: boolean;
  online: boolean;
  install: () => void;
  updates: AppUpdates;
  applyUpdate: () => void;
  view: SettingsView;
  onViewChange: (view: SettingsView) => void;
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
      if (commit(next, "Income saved")) {
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
        ...data.settings,
        giving: draft.giving,
        expenses: cents(expenses),
      };
      const next = splitChanged
        ? dataWithIncomeSplit({ ...data, settings }, split)
        : { ...data, settings };
      validate(next);
      if (commit(next, "Split saved")) {
        setError("");
        setIncomeError("");
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
  function saveDisplay(e: FormEvent) {
    e.preventDefault();
    try {
      const next = validate({
        ...data,
        settings: {
          ...data.settings,
          currency: draft.currency,
          appearance: draft.appearance,
        },
      });
      if (commit(next, "Appearance saved")) setError("");
      else setError("Could not save. Try again.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function go(next: SettingsView) {
    setError("");
    onViewChange(next);
    window.scrollTo({ top: 0, behavior: "instant" });
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
    incomeValid = true,
    expensesValid = true;
  try {
    previewIncome = cents(income);
  } catch {
    incomeValid = false;
  }
  try {
    previewExpenses = cents(expenses);
  } catch {
    expensesValid = false;
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
  const displayChanged =
    draft.currency !== data.settings.currency ||
    draft.appearance !== data.settings.appearance;
  const splitDirty =
    !expensesValid ||
    draft.giving !== data.settings.giving ||
    previewExpenses !== data.settings.expenses ||
    (splitChanged &&
      JSON.stringify(split) !== JSON.stringify(incomeSplitFromPlan(data)));
  const titles: Record<SettingsView, string> = {
    menu: "Settings",
    income: "Income",
    split: "Money split",
    display: "Appearance",
    backups: "Backups",
    updates: "App updates",
  };
  const frequency = {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    semimonthly: "Twice a month",
    monthly: "Monthly",
  }[data.settings.frequency];
  return (
    <>
      <PageTitle
        title={titles[view]}
        onBack={view !== "menu" ? () => go("menu") : undefined}
      />
      {view === "menu" ? (
        <div className="settings-menu">
          <MenuRow
            icon={<Wallet size={21} />}
            label="Income"
            detail={
              incomeChanged
                ? "Unsaved changes"
                : `${money(data.settings.income, data.settings.currency, true)} · ${frequency}`
            }
            onClick={() => go("income")}
          />
          <MenuRow
            icon={<SlidersHorizontal size={21} />}
            label="Money split"
            detail={
              splitDirty ? "Unsaved changes" : "Savings, spending & tithing"
            }
            onClick={() => go("split")}
          />
          <MenuRow
            icon={<SunMoon size={21} />}
            label="Appearance"
            detail={
              displayChanged
                ? "Unsaved changes"
                : `${{ system: "System", light: "Light", dark: "Dark" }[data.settings.appearance]} · ${data.settings.currency}`
            }
            onClick={() => go("display")}
          />
          <MenuRow
            icon={<ShieldCheck size={21} />}
            label="Backups"
            detail="Saved on this device"
            onClick={() => go("backups")}
          />
          <MenuRow
            icon={<RefreshCw size={21} />}
            label="App updates"
            detail={updates.needRefresh ? "Update ready" : __APP_VERSION__}
            onClick={() => go("updates")}
          />
        </div>
      ) : null}
      {view === "income" ? (
        <form
          className="settings-panel"
          onSubmit={(e) => {
            e.preventDefault();
            saveIncome();
          }}
        >
          <Field label="Pay amount">
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
          <Field label="Paid">
            <select
              value={draft.frequency}
              onChange={(e) => update("frequency", e.target.value as Frequency)}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="semimonthly">Twice a month</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          {draft.frequency === "semimonthly" ? (
            <div className="form-grid">
              <Field label="First day (1–27)">
                <input
                  type="number"
                  min="1"
                  max="27"
                  value={draft.firstDay}
                  onChange={(e) => update("firstDay", Number(e.target.value))}
                />
              </Field>
              <Field label="Second day (2–31)">
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
            <Field label="Payday (1–31)" hint="Short months use the last day.">
              <input
                type="number"
                min="1"
                max="31"
                value={draft.monthlyDay}
                onChange={(e) => update("monthlyDay", Number(e.target.value))}
              />
            </Field>
          ) : null}
          <Field label="Next payday">
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
            / month on average
          </p>
          <FormError error={incomeError} />
          <Button type="submit" disabled={!incomeChanged}>
            Save income
          </Button>
          <p
            className="fine-print income-save-status"
            role="status"
            aria-live="polite"
          >
            {incomeChanged ? "Unsaved changes" : incomeSaved ? "Saved" : ""}
          </p>
        </form>
      ) : null}
      {view === "split" ? (
        <form className="settings-panel" onSubmit={submit}>
          <SplitEditor
            data={{
              ...data,
              settings: {
                ...data.settings,
                giving: draft.giving,
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
          {mainGoal(data) ? (
            <Button type="submit" disabled={!splitDirty || Boolean(splitError)}>
              Save split
            </Button>
          ) : null}

          <FormError error={error} />
        </form>
      ) : null}
      {view === "display" ? (
        <form className="settings-panel" onSubmit={saveDisplay}>
          <Field label="Display currency">
            <select
              value={draft.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </Field>
          <Field label="Theme">
            <select
              value={draft.appearance}
              onChange={(e) => update("appearance", e.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <FormError error={error} />
          <Button type="submit" disabled={!displayChanged}>
            Save appearance
          </Button>
        </form>
      ) : null}
      {view === "updates" ? (
        <div className="settings-panel">
          <div className="status-row">
            <RefreshCw size={21} />
            <div>
              <strong>Version {__APP_VERSION__}</strong>
              <small role="status" aria-live="polite">
                {updates.status === "applying"
                  ? "Updating…"
                  : updates.status === "checking"
                    ? "Checking…"
                    : updates.status === "error" || updates.status === "offline"
                      ? updates.message
                      : updates.needRefresh
                        ? "Update ready"
                        : updates.status === "current"
                          ? "Up to date"
                          : updates.message || ""}
              </small>
            </div>
          </div>
          {updates.needRefresh && unsaved ? (
            <p className="fine-print">Save changes first.</p>
          ) : null}
          <Button
            secondary={!updates.needRefresh}
            disabled={updateBusy || (updates.needRefresh && unsaved)}
            onClick={() =>
              updates.needRefresh
                ? applyUpdate()
                : void updates.checkForUpdates()
            }
          >
            {updateLabel}
          </Button>

          {unsaved ? (
            <Button
              secondary
              onClick={() =>
                go(incomeChanged ? "income" : splitDirty ? "split" : "display")
              }
            >
              Review changes
            </Button>
          ) : null}
          <div className="settings-secondary">
            <div className="status-row">
              <Smartphone size={21} />
              <div>
                <strong>
                  {offlineReady ? "Offline ready" : "Preparing offline access…"}
                </strong>
                <small>
                  {online ? "Online" : "You’re offline"}
                  {!offlineReady ? " · Connect to prepare" : ""}
                </small>
              </div>
              {offlineReady ? <CheckCircle2 size={19} /> : null}
            </div>
            <Button secondary onClick={install}>
              Add to Home Screen
            </Button>
          </div>
        </div>
      ) : null}
      {view === "backups" ? (
        <div className="settings-panel">
          <p className="section-description">On this device. No cloud sync.</p>
          <div className="button-stack">
            <Button
              secondary
              onClick={() => {
                download(
                  JSON.stringify(data, null, 2),
                  `savings-backup-${today()}.json`,
                );
                setBackupLabel("Backup downloaded");
              }}
            >
              <Download size={17} />
              Export backup
            </Button>
            <Button secondary onClick={() => fileRef.current?.click()}>
              <Upload size={17} />
              Restore backup
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
            Previous save
          </button>
          {backupLabel ? (
            <p className="success-note" role="status">
              {backupLabel}
            </p>
          ) : null}

          <FormError error={error} />
        </div>
      ) : null}
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
          Replace this plan with {incoming.goals.length} goals and{" "}
          {incoming.transactions.length} records? A safety backup downloads
          first.
        </Confirm>
      ) : null}
    </>
  );
}

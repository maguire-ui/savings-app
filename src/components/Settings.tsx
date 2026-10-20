import { useRef, useState, type FormEvent } from "react";
import {
  Download,
  Upload,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  type Data,
  type Settings,
  type Frequency,
  cents,
  today,
  validate,
  money,
} from "../model";
import { download, PREVIOUS } from "../storage";
import { PageTitle, Section, Field, AmountInput, Button } from "./UI";
import { type Commit, FormError, Confirm } from "./Forms";
export function SettingsPage({
  data,
  commit,
  offlineReady,
  online,
  install,
}: {
  data: Data;
  commit: Commit;
  offlineReady: boolean;
  online: boolean;
  install: () => void;
}) {
  const [draft, setDraft] = useState<Settings>({ ...data.settings }),
    [income, setIncome] = useState(String(data.settings.income / 100)),
    [error, setError] = useState(""),
    [incoming, setIncoming] = useState<Data | null>(null),
    [backupLabel, setBackupLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const update = (key: keyof Settings, value: unknown) =>
    setDraft((s) => ({ ...s, [key]: value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const settings = { ...draft, income: cents(income) };
      validate({ ...data, settings });
      if (commit({ ...data, settings }, "Settings saved")) setError("");
      else
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
  return (
    <>
      <PageTitle
        title="Settings"
        subtitle="A savings plan that fits your life."
      />
      <form onSubmit={submit}>
        <Section title="Income & paydays">
          <Field label={`Paycheque amount (${draft.currency})`}>
            <AmountInput
              value={income}
              onChange={setIncome}
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
            hint="Planning dates never add money. In Record income, mark an earning as your scheduled payday to advance this date."
          >
            <input
              type="date"
              value={draft.nextPayday}
              onInput={(e) => {
                const value = e.currentTarget.value;
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
            {draft.frequency === "biweekly"
              ? "Biweekly uses 26 paycheques for the annual average. Some calendar years contain 27; forecasts use actual dates. "
              : ""}
            {money(
              Math.round(
                (Math.max(0, Number(income) || 0) * 100 * periods) / 12,
              ),
              draft.currency,
            )}{" "}
            a month on average.
          </p>
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
          <p className="fine-print">
            Tithing starts at 10% of each paycheque, as requested. Change it and
            your savings allocation in Budget.
          </p>
          <FormError error={error} />
          <Button type="submit">Save settings</Button>
        </Section>
      </form>
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
              {online ? "Online" : "You’re offline"} ·{" "}
              {offlineReady
                ? "The app interface has been saved on this device."
                : "Open the hosted app online to download it."}
            </small>
          </div>
          {offlineReady ? <CheckCircle2 size={19} /> : null}
        </div>
        <ol className="install-steps">
          <li>Open this app’s website in Safari.</li>
          <li>Tap Share, then Add to Home Screen.</li>
          <li>Keep “Open as Web App” on, then tap Add.</li>
          <li>Open it once online and check “Ready to use offline” here.</li>
        </ol>
        <p className="fine-print">
          Use the Home Screen app for your saved plan. Safari and the Home
          Screen app may have separate storage. Export and import a backup if
          you move between them.
        </p>
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
              No bank connection. No account. No financial data sent to a
              server.
            </small>
          </div>
        </div>
        <p className="fine-print">
          Device storage can be cleared by you or the system. Keep a backup
          somewhere you trust. Backups contain your balances and activity in
          plain text; there is no automatic cloud sync.
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
      <p className="app-footer">
        Savings · Version 1.0
        <br />A little closer, every payday.
      </p>
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
            )
              setIncoming(null);
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

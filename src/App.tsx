import { TithingVault } from "./components/TithingVault";
import { Toast, type ToastNotice } from "./components/Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home as HomeIcon,
  Flag,
  ChartPie,
  Settings as SettingsIcon,
  Plus,
  WifiOff,
  RefreshCw,
  Pencil,
  Archive,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { useAppUpdates } from "./useAppUpdates";
import {
  type Data,
  type Goal,
  type Transaction,
  balances,
  forecasts,
  remaining,
  money,
  mainGoal,
  shortDate,
  validate,
} from "./model";
import { load, save, download, KEY, PREVIOUS } from "./storage";
import { UndoMoney } from "./components/UndoMoney";
import { IncomeForm } from "./components/IncomeForm";
import { Home, Activity } from "./components/Home";
import { Budget } from "./components/Budget";
import { SettingsPage, type SettingsView } from "./components/Settings";
import {
  PageTitle,
  Section,
  Ring,
  ForecastRow,
  Button,
  GoalRow,
  Empty,
  AddLabel,
  Modal,
} from "./components/UI";
import { GoalForm, TransactionForm, Confirm } from "./components/Forms";
const loaded = load();
export default function App() {
  const [data, setData] = useState<Data>(loaded.data),
    [recovery, setRecovery] = useState(loaded.error),
    [page, setPage] = useState("home"),
    [settingsView, setSettingsView] = useState<SettingsView>("menu"),
    [selected, setSelected] = useState<string | null>(null),
    [sheet, setSheet] = useState<
      "goal" | "transaction" | "income" | "install" | "vault" | null
    >(null),
    [editing, setEditing] = useState<Goal | undefined>(),
    [goalType, setGoalType] = useState<"main" | "side">("main"),
    [tx, setTx] = useState<Transaction | null>(null),
    [undoTarget, setUndoTarget] = useState<string | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      copy: string;
      action: string;
      run: () => void;
    } | null>(null),
    [toast, setToast] = useState<ToastNotice | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const toastSequence = useRef(0);
  const dismissToast = useCallback((id: number) => {
    setToast((current) => (current?.id === id ? null : current));
  }, []);
  function notify(message: string) {
    setToast({ id: ++toastSequence.current, message });
  }
  const updates = useAppUpdates();
  const { offlineReady, needRefresh } = updates;
  const updateBlocked = Boolean(
    sheet ||
    tx ||
    confirm ||
    undoTarget ||
    ["settings", "budget", "scenario"].includes(page),
  );
  function applyAppUpdate() {
    if (updates.status === "applying") return;
    download(JSON.stringify(data, null, 2), "savings-before-update.json");
    void updates.applyUpdate();
  }
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    const storage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const fresh = load();
        if (fresh.error) setRecovery(fresh.error);
        else {
          setData(fresh.data);
          notify("Updated from another tab.");
        }
      }
    };
    addEventListener("storage", storage);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
      removeEventListener("storage", storage);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appearance = data.settings.appearance;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => {
      const dark =
        data.settings.appearance === "dark" ||
        (data.settings.appearance === "system" && media.matches);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#151e19" : "#f7f6f2");
    };
    theme();
    media.addEventListener("change", theme);
    return () => media.removeEventListener("change", theme);
  }, [data.settings.appearance]);
  function commit(next: Data, message = "Saved") {
    try {
      const stored = save(next, data.revision);
      setData(stored);
      notify(message);
      return true;
    } catch (err) {
      notify(
        (err as Error).message ||
          "Storage is full. Export a backup before making more changes.",
      );
      return false;
    }
  }
  function navigate(next: string) {
    if (next === "settings") setSettingsView("menu");
    setPage(next);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openSplit() {
    navigate("settings");
    setSettingsView("split");
  }
  function newGoal(type: "main" | "side") {
    setGoalType(type);
    setEditing(undefined);
    setSheet("goal");
  }
  function openGoal(g: Goal) {
    setSelected(g.id);
    setPage("goal");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const b = balances(data),
    fc = forecasts(data),
    goal = data.goals.find((g) => g.id === selected),
    main = mainGoal(data);
  function archive(g: Goal) {
    setConfirm({
      title: "Archive this goal?",
      copy: "Its balance and activity stay saved. It will stop receiving future funding. You can restore it from the archived list.",
      action: "Archive goal",
      run: () => {
        if (
          commit(
            {
              ...data,
              goals: data.goals.map((x) =>
                x.id === g.id ? { ...x, status: "archived" } : x,
              ),
            },
            "Goal archived",
          )
        ) {
          setConfirm(null);
          navigate("quests");
        }
      },
    });
  }
  function deleteGoal(g: Goal) {
    if (b[g.id]) {
      notify(
        "Remove or reassign the balance before deleting. You can archive it with its balance intact.",
      );
      return;
    }
    setConfirm({
      title: "Delete this goal?",
      copy: "The goal will be hidden. Its activity is retained in your backup and history.",
      action: "Delete goal",
      run: () => {
        if (
          commit(
            {
              ...data,
              goals: data.goals.map((x) =>
                x.id === g.id ? { ...x, status: "archived", deleted: true } : x,
              ),
            },
            "Goal deleted",
          )
        ) {
          setConfirm(null);
          navigate("quests");
        }
      },
    });
  }
  if (recovery)
    return (
      <main className="recovery">
        <h1>Your savings are still here.</h1>
        <p>{recovery}</p>
        <div className="button-stack">
          <Button
            onClick={() =>
              download(
                loaded.raw || localStorage.getItem(KEY) || "",
                "savings-recovery-original.json",
              )
            }
          >
            Download original data
          </Button>
          <Button
            secondary
            onClick={() => {
              try {
                const raw = localStorage.getItem(PREVIOUS);
                if (!raw) throw Error("No previous save is available.");
                const previous = validate(JSON.parse(raw));
                localStorage.setItem(KEY, JSON.stringify(previous));
                setData(previous);
                setRecovery("");
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Recover previous save
          </Button>
          <label className="button-secondary">
            Restore a backup
            <input
              type="file"
              accept=".json"
              className="visually-hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 5e6) throw Error("Backup too large.");
                  const recovered = validate(JSON.parse(await file.text()));
                  download(
                    localStorage.getItem(KEY) || "",
                    "savings-recovery-original.json",
                  );
                  localStorage.setItem(KEY, JSON.stringify(recovered));
                  setData(recovered);
                  setRecovery("");
                } catch (err) {
                  notify((err as Error).message);
                }
              }}
            />
          </label>
        </div>
        <Toast notice={toast} onDismiss={dismissToast} role="alert" />
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="desktop-brand">
        <span className="brand-dot" />
        Savings
      </div>
      <nav className="navigation" aria-label="Main navigation">
        {[
          { id: "home", label: "Home", Icon: HomeIcon },
          { id: "quests", label: "Side Quests", Icon: Flag },
          { id: "budget", label: "Budget", Icon: ChartPie },
          { id: "settings", label: "Settings", Icon: SettingsIcon },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-current={page === id ? "page" : undefined}
            className={page === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={21} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="app-shell">
        {!online ? (
          <div className="connection-banner">
            <WifiOff size={15} />
            Offline · changes stay on this device
          </div>
        ) : null}
        {needRefresh && page !== "settings" ? (
          <div className="update-banner">
            <span>
              {updateBlocked
                ? "Update ready · finish editing before updating."
                : "Update available · your plan stays saved."}
            </span>
            <button
              disabled={updateBlocked || updates.status === "applying"}
              onClick={applyAppUpdate}
            >
              <RefreshCw size={15} />
              {updates.status === "applying" ? "Updating…" : "Update"}
            </button>
          </div>
        ) : null}
        {updates.registrationError ? (
          <p className="form-error">{updates.registrationError}</p>
        ) : null}
        <main id="main" key={page}>
          {page === "home" ? (
            <Home
              data={data}
              vault={() => setSheet("vault")}
              openGoal={openGoal}
              newMain={() => newGoal("main")}
              add={() => {
                setSelected(main?.id || null);
                setSheet("transaction");
              }}
              income={() => setSheet("income")}
              navigate={navigate}
              activity={setTx}
            />
          ) : null}
          {page === "quests" ? (
            <>
              <PageTitle
                title="Side Quests"
                action={
                  <button
                    className="icon-button"
                    aria-label="New Side Quest"
                    onClick={() => newGoal("side")}
                  >
                    <Plus size={23} />
                  </button>
                }
              />
              {data.goals.some(
                (g) =>
                  g.type === "side" && !g.deleted && g.status !== "archived",
              ) ? (
                <>
                  <div className="quest-mode">
                    <span>
                      {data.settings.mode === "focus"
                        ? "Main goal only"
                        : "Shared savings"}
                    </span>
                    <button className="text-link" onClick={openSplit}>
                      Money split
                    </button>
                  </div>
                  {(["active", "wishlist", "paused", "completed"] as const).map(
                    (status) => {
                      const goals = data.goals
                        .filter(
                          (g) =>
                            g.type === "side" &&
                            g.status === status &&
                            !g.deleted,
                        )
                        .sort((a, b) => a.priority - b.priority);
                      return goals.length ? (
                        <Section
                          key={status}
                          title={
                            {
                              active: "Saving for",
                              wishlist: "Your wishlist",
                              paused: "On pause",
                              completed: "Completed",
                            }[status]
                          }
                        >
                          {goals.map((g) => (
                            <GoalRow
                              key={g.id}
                              goal={g}
                              balance={b[g.id]}
                              currency={data.settings.currency}
                              forecast={fc[g.id]}
                              onClick={() => openGoal(g)}
                            />
                          ))}
                        </Section>
                      ) : null;
                    },
                  )}
                  <Button secondary onClick={() => newGoal("side")}>
                    <AddLabel>New Side Quest</AddLabel>
                  </Button>
                </>
              ) : (
                <Empty
                  title="Your first Side Quest"
                  action={
                    <Button onClick={() => newGoal("side")}>
                      Add a Side Quest
                    </Button>
                  }
                >
                  Save for something smaller, or add it to your wishlist.
                </Empty>
              )}
              {data.goals.some((g) => g.status === "archived" && !g.deleted) ? (
                <Section title="Archived goals">
                  {data.goals
                    .filter((g) => g.status === "archived" && !g.deleted)
                    .map((g) => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        balance={b[g.id]}
                        currency={data.settings.currency}
                        onClick={() => openGoal(g)}
                      />
                    ))}
                </Section>
              ) : null}
            </>
          ) : null}
          {page === "goal" && goal ? (
            <>
              <PageTitle
                title={goal.name}
                onBack={() =>
                  navigate(goal.type === "main" ? "home" : "quests")
                }
                action={
                  <button
                    className="icon-button"
                    aria-label="Edit goal"
                    onClick={() => {
                      setEditing(goal);
                      setGoalType(goal.type);
                      setSheet("goal");
                    }}
                  >
                    <Pencil size={20} />
                  </button>
                }
              />
              {goal.type === "main" ? (
                <Ring
                  saved={b[goal.id]}
                  target={goal.target}
                  currency={data.settings.currency}
                />
              ) : (
                <div className="quest-detail">
                  <strong>
                    {money(b[goal.id], data.settings.currency, true)}
                  </strong>
                  <span>
                    of {money(goal.target, data.settings.currency, true)}
                  </span>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(100, (b[goal.id] / goal.target) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <ForecastRow
                left={remaining(goal, b[goal.id])}
                forecast={fc[goal.id]}
                currency={data.settings.currency}
              />
              {goal.targetDate ? (
                <p className="target-date">
                  Your target: {shortDate(goal.targetDate, true)}
                  {fc[goal.id]?.date && fc[goal.id].date! > goal.targetDate
                    ? " · Current plan arrives later"
                    : ""}
                </p>
              ) : null}
              {goal.status !== "archived" ? (
                <Button onClick={() => setSheet("transaction")}>
                  {goal.type === "main"
                    ? "Add or remove savings"
                    : "Record savings or purchase"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (goal.type === "main" && main) {
                      notify(
                        "Archive your current main goal before restoring another.",
                      );
                      return;
                    }
                    commit(
                      {
                        ...data,
                        goals: data.goals.map((g) =>
                          g.id === goal.id
                            ? {
                                ...g,
                                status:
                                  goal.type === "main" ? "active" : "paused",
                              }
                            : g,
                        ),
                      },
                      "Goal restored",
                    );
                  }}
                >
                  Restore goal
                </Button>
              )}
              {goal.type === "main" && goal.status !== "archived" ? (
                <button
                  className="text-link spaced"
                  onClick={() => setPage("scenario")}
                >
                  What if I saved more?
                </button>
              ) : null}
              {fc[goal.id]?.date ? (
                <p className="fine-print">
                  Estimates assume your planned contributions each payday.
                </p>
              ) : null}
              <Section title="Contribution history">
                <Activity
                  data={data}
                  goalId={goal.id}
                  onSelect={setTx}
                  limit={100000}
                />
              </Section>
              <div className="goal-actions">
                {goal.status !== "archived" ? (
                  <button onClick={() => archive(goal)}>
                    <Archive size={17} />
                    Archive goal
                  </button>
                ) : null}
                <button onClick={() => deleteGoal(goal)}>
                  <Trash2 size={17} />
                  Delete goal
                </button>
              </div>
            </>
          ) : null}
          {page === "scenario" ? (
            <>
              <button
                className="text-link spaced"
                onClick={() => setPage("goal")}
              >
                <ArrowLeft size={16} />
                Back to goal
              </button>
              <Budget
                key={data.revision}
                data={data}
                commit={commit}
                scenarioOnly
              />
            </>
          ) : null}
          {page === "budget" ? (
            <Budget
              key={data.revision}
              data={data}
              commit={commit}
              onEditSplit={openSplit}
            />
          ) : null}
          {page === "settings" ? (
            <SettingsPage
              data={data}
              commit={commit}
              view={settingsView}
              onViewChange={setSettingsView}
              offlineReady={offlineReady}
              online={online}
              install={() => setSheet("install")}
              updates={updates}
              applyUpdate={applyAppUpdate}
            />
          ) : null}
          {page === "activity" ? (
            <>
              <PageTitle title="All activity" onBack={() => navigate("home")} />
              <Activity data={data} onSelect={setTx} limit={100000} />
            </>
          ) : null}
        </main>
      </div>
      <Toast notice={toast} onDismiss={dismissToast} />
      {sheet === "goal" ? (
        <GoalForm
          data={data}
          goal={editing}
          type={goalType}
          onClose={() => setSheet(null)}
          commit={commit}
        />
      ) : null}
      {sheet === "transaction" ? (
        <TransactionForm
          data={data}
          goalId={selected || undefined}
          onClose={() => setSheet(null)}
          commit={commit}
        />
      ) : null}
      {sheet === "income" ? (
        <IncomeForm
          data={data}
          commit={commit}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "vault" ? (
        <TithingVault data={data} commit={commit} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "install" ? (
        <Modal title="Add to Home Screen" onClose={() => setSheet(null)}>
          <p>Open this website in Safari on your iPhone.</p>
          <ol className="install-steps">
            <li>Tap Share → Add to Home Screen.</li>
            <li>Keep “Open as Web App” enabled and tap Add.</li>
            <li>
              Open once online. Check Settings → App updates → Offline ready.
            </li>
          </ol>
          <p className="fine-print">
            Keep this icon for updates. Export a backup before reinstalling.
          </p>
          <Button onClick={() => setSheet(null)}>Got it</Button>
        </Modal>
      ) : null}
      {tx ? (
        <Modal title="Activity details" onClose={() => setTx(null)}>
          <p className="muted">
            {shortDate(tx.date, true)} ·{" "}
            {
              {
                income: "Income",
                payday: "Payday",
                deposit: "Savings",
                withdrawal: "Withdrawal",
                purchase: "Purchase",
                opening: "Starting balance",
              }[tx.kind]
            }
            {tx.voided ? " · Undone" : ""}
          </p>
          <h3>{tx.note || "Savings activity"}</h3>
          <div className="detail-list">
            {tx.entries.map((e, i) => (
              <div key={i}>
                <span>
                  {data.goals.find((g) => g.id === e.goalId)?.name ||
                    "Archived goal"}
                </span>
                <strong>
                  {e.amount < 0 ? "−" : "+"}
                  {money(Math.abs(e.amount), data.settings.currency)}
                </strong>
              </div>
            ))}
          </div>
          {tx.kind === "payday" || tx.kind === "income" ? (
            <p className="fine-print">
              Income: {money(tx.gross || 0, data.settings.currency)} · Tithing:{" "}
              {money(tx.giving || 0, data.settings.currency)}
              {tx.expenses ? (
                <> · Expenses: {money(tx.expenses, data.settings.currency)}</>
              ) : null}{" "}
              · Spending: {money(tx.spending || 0, data.settings.currency)}
            </p>
          ) : null}
          <p className="fine-print">
            A tracking record only. No bank transfer was made.
          </p>
          {!tx.voided ? (
            <Button
              secondary
              onClick={() => {
                setUndoTarget(tx.id);
                setTx(null);
              }}
            >
              Undo record
            </Button>
          ) : null}
        </Modal>
      ) : null}
      {undoTarget ? (
        <UndoMoney
          data={data}
          transactionId={undoTarget}
          commit={commit}
          onClose={() => setUndoTarget(null)}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title={confirm.title}
          action={confirm.action}
          onClose={() => setConfirm(null)}
          onConfirm={confirm.run}
        >
          {confirm.copy}
        </Confirm>
      ) : null}
    </>
  );
}

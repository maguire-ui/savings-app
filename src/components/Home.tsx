import {
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from "lucide-react";
import {
  type Data,
  type Goal,
  type Transaction,
  mainGoal,
  balances,
  budget,
  forecasts,
  remaining,
  money,
  shortDate,
  paydays,
  today,
} from "../model";
import {
  Ring,
  ForecastRow,
  Section,
  Empty,
  Button,
  GoalRow,
  AddLabel,
  CurrencyLabel,
} from "./UI";
export function Activity({
  data,
  goalId,
  onSelect,
  limit = 6,
}: {
  data: Data;
  goalId?: string;
  onSelect: (t: Transaction) => void;
  limit?: number;
}) {
  const rows = [...data.transactions]
    .reverse()
    .filter((t) => !goalId || t.entries.some((e) => e.goalId === goalId))
    .slice(0, limit);
  return rows.length ? (
    <div className="activity-list">
      {rows.map((t) => {
        const amount = t.entries
          .filter((e) => !goalId || e.goalId === goalId)
          .reduce((s, e) => s + e.amount, 0);
        const names = t.entries
          .map((e) => data.goals.find((g) => g.id === e.goalId)?.name)
          .filter(Boolean)
          .join(", ");
        return (
          <button
            key={t.id}
            className={`activity-row ${t.voided ? "voided" : ""}`}
            onClick={() => onSelect(t)}
          >
            <span className="activity-icon">
              {amount >= 0 ? (
                <ArrowDownLeft size={18} />
              ) : (
                <ArrowUpRight size={18} />
              )}
            </span>
            <span className="activity-copy">
              <strong>
                {t.note ||
                  {
                    deposit: "Savings added",
                    withdrawal: "Savings removed",
                    purchase: "Purchase",
                    opening: "Starting balance",
                    payday: "Payday savings",
                  }[t.kind]}
                {t.voided ? " · Undone" : ""}
              </strong>
              <small>
                {shortDate(t.date)}
                {names ? ` · ${names}` : ""}
              </small>
            </span>
            <span className={amount >= 0 ? "positive" : ""}>
              {amount >= 0 ? "+" : "−"}
              {money(Math.abs(amount), data.settings.currency, true)}
            </span>
            <ChevronRight className="muted" size={15} />
          </button>
        );
      })}
    </div>
  ) : (
    <p className="empty-line">Your recorded savings will appear here.</p>
  );
}
export function Home({
  data,
  openGoal,
  newMain,
  add,
  payday,
  navigate,
  activity,
}: {
  data: Data;
  openGoal: (g: Goal) => void;
  newMain: () => void;
  add: () => void;
  payday: () => void;
  navigate: (s: string) => void;
  activity: (t: Transaction) => void;
}) {
  const main = mainGoal(data),
    b = balances(data),
    plan = budget(data.settings),
    fc = forecasts(data),
    upcoming = paydays(data.settings, 1)[0];
  const sides = data.goals.filter(
    (g) => g.type === "side" && !g.deleted && g.status !== "archived",
  );
  return (
    <>
      <header className="home-header">
        <h1>
          Savings
          <span className="brand-dot" />
        </h1>
        <button
          className="icon-button"
          aria-label="Open settings"
          onClick={() => navigate("settings")}
        >
          <Settings size={22} strokeWidth={1.7} />
        </button>
      </header>
      <div className="home-columns">
        <div className="main-column">
          {main ? (
            <section className="main-progress">
              <button className="goal-title" onClick={() => openGoal(main)}>
                {main.name}
                <ChevronRight size={16} />
              </button>
              <CurrencyLabel settings={data.settings} />
              <Ring
                saved={b[main.id]}
                target={main.target}
                currency={data.settings.currency}
              />
              <ForecastRow
                left={remaining(main, b[main.id])}
                forecast={fc[main.id]}
                currency={data.settings.currency}
              />
              <Button onClick={add}>
                <AddLabel>Add savings</AddLabel>
              </Button>
              <button
                className="text-link goal-detail-link"
                onClick={() => openGoal(main)}
              >
                View goal & history <ChevronRight size={14} />
              </button>
            </section>
          ) : (
            <Empty
              title="Something to look forward to"
              action={<Button onClick={newMain}>Set your main goal</Button>}
            >
              Choose one big goal. Make room for the everyday. Start with
              whatever you have.
            </Empty>
          )}
        </div>
        <div className="support-column">
          <Section
            title="Next paycheque"
            action={
              <button
                className="text-link"
                onClick={() => navigate("settings")}
              >
                {shortDate(upcoming || null)}
              </button>
            }
          >
            {data.settings.income ? (
              <>
                <div className="paycheque-amount">
                  {money(plan.income, data.settings.currency, true)}
                  <CurrencyLabel settings={data.settings} />
                </div>
                <div className="pay-split">
                  {[
                    ["Giving", plan.giving],
                    ["Savings", plan.savings],
                    ["Spending", plan.spending],
                    ["Expenses", plan.expenses],
                  ].map(([label, n]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>
                        {money(n as number, data.settings.currency, true)}
                      </strong>
                    </div>
                  ))}
                </div>
                {data.settings.nextPayday && main ? (
                  <button className="payday-link" onClick={payday}>
                    {data.settings.nextPayday <= today()
                      ? "Record payday savings"
                      : "View payday plan"}
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    className="text-link spaced"
                    onClick={() => navigate("settings")}
                  >
                    Set your next payday
                  </button>
                )}
              </>
            ) : (
              <div className="setup-prompt">
                <p>Give your goal a timeline.</p>
                <span>
                  Add your income and pay schedule to see what’s possible.
                </span>
                <button
                  className="text-link"
                  onClick={() => navigate("settings")}
                >
                  Set up income <ChevronRight size={15} />
                </button>
              </div>
            )}
          </Section>
          <Section
            title="Side Quests"
            action={
              <button className="text-link" onClick={() => navigate("quests")}>
                View all
              </button>
            }
          >
            {sides.length ? (
              sides
                .slice(0, 2)
                .map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    balance={b[g.id]}
                    currency={data.settings.currency}
                    forecast={fc[g.id]}
                    onClick={() => openGoal(g)}
                  />
                ))
            ) : (
              <div className="setup-prompt">
                <p>The little things matter, too.</p>
                <span>Keep a wishlist or save alongside your main goal.</span>
                <button
                  className="text-link"
                  onClick={() => navigate("quests")}
                >
                  Add a Side Quest <ChevronRight size={15} />
                </button>
              </div>
            )}
          </Section>
        </div>
      </div>
      <Section
        title="Recent activity"
        action={
          data.transactions.length > 6 ? (
            <button className="text-link" onClick={() => navigate("activity")}>
              View all
            </button>
          ) : null
        }
      >
        <Activity data={data} onSelect={activity} />
      </Section>
    </>
  );
}

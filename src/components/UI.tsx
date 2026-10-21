import { Input } from "./Input";
import {
  useEffect,
  useRef,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  X,
  ArrowLeft,
  Plus,
  Check,
  Target,
  Gamepad2,
  Plane,
  Gift,
  ShoppingBag,
  Headphones,
  ChevronRight,
} from "lucide-react";
import { money, percent, shortDate, type Forecast, type Goal } from "../model";
export const icons = {
  target: Target,
  game: Gamepad2,
  travel: Plane,
  gift: Gift,
  shopping: ShoppingBag,
  audio: Headphones,
};
export function GoalIcon({ name = "target" }: { name?: string }) {
  const Icon = icons[name as keyof typeof icons] || Target;
  return <Icon size={20} strokeWidth={1.7} />;
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`${secondary ? "button-secondary" : "button-primary"} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function MenuRow({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  const detailId = useId();
  return (
    <button
      className="menu-row"
      type="button"
      aria-label={label}
      aria-describedby={detail ? detailId : undefined}
      onClick={onClick}
    >
      <span className="menu-row-icon">{icon}</span>
      <span className="menu-row-label">
        <strong>{label}</strong>
        {detail ? <small id={detailId}>{detail}</small> : null}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      {onBack ? (
        <button className="icon-button back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={21} />
        </button>
      ) : null}
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Target size={26} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Ring({
  saved,
  target,
  currency,
}: {
  saved: number;
  target: number;
  currency: string;
}) {
  const pct = Math.min(100, Math.max(0, target ? (saved * 100) / target : 0));
  const amount = money(saved, currency, true);
  const goalAmount = `of ${money(target, currency, true)}`;
  return (
    <div
      className="ring"
      role="img"
      aria-label={`${money(saved, currency)} of ${money(target, currency)}, ${Math.floor(pct)} percent saved`}
    >
      <svg
        className="ring-graphic"
        width="260"
        height="260"
        viewBox="0 0 260 260"
        aria-hidden="true"
      >
        <circle className="ring-track" cx="130" cy="130" r="117" />
        <circle
          className="ring-value"
          transform="rotate(-90 130 130)"
          opacity={pct > 0 ? 1 : 0}
          cx="130"
          cy="130"
          r="117"
          pathLength="100"
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <div className="ring-content">
        <div
          className="ring-label"
          style={{ "--amount-width": amount.length * 0.62 } as CSSProperties}
        >
          <strong className="ring-amount">{amount}</strong>
          <div className="ring-caption">
            <span
              style={
                { "--goal-width": goalAmount.length * 0.58 } as CSSProperties
              }
            >
              {goalAmount}
            </span>
            <b>{Math.floor(pct)}% saved</b>
          </div>
        </div>
      </div>
    </div>
  );
}
export function ForecastRow({
  left,
  forecast,
  currency,
}: {
  left: number;
  forecast?: Forecast;
  currency: string;
}) {
  const leftAmount = money(left, currency, true);
  return (
    <>
      <div
        className={`forecast-row${leftAmount.length > 9 ? " forecast-wide" : ""}`}
      >
        <div>
          <strong>{leftAmount}</strong>
          <span>Left to save</span>
        </div>
        <div>
          <strong>{forecast?.count ?? "—"}</strong>
          <span>Paycheques</span>
        </div>
        <div>
          <strong>{shortDate(forecast?.date || null)}</strong>
          <span>
            Projected{forecast?.date ? ` · ${forecast.date.slice(0, 4)}` : ""}
          </span>
        </div>
      </div>
      {forecast?.count === null ? (
        <p className="forecast-note">{forecast.reason}.</p>
      ) : null}
    </>
  );
}
export function GoalRow({
  goal,
  balance,
  currency,
  forecast,
  onClick,
}: {
  goal: Goal;
  balance: number;
  currency: string;
  forecast?: Forecast;
  onClick: () => void;
}) {
  const pct = Math.min(100, (balance / goal.target) * 100);
  return (
    <button className="goal-row" onClick={onClick}>
      <span className="goal-row-heading">
        <span className="goal-name">
          <GoalIcon name={goal.icon} />
          <span>{goal.name}</span>
        </span>
        <span className="goal-amount">
          {money(balance, currency, true)}{" "}
          <span className="muted">/ {money(goal.target, currency, true)}</span>
        </span>
      </span>
      <span className="progress-track">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="goal-row-footer">
        <span>
          {goal.status === "completed"
            ? "Completed"
            : goal.status === "active"
              ? `${percent(goal.allocation)} of savings`
              : {
                  wishlist: "Wishlist",
                  paused: "Paused",
                  archived: "Archived",
                }[goal.status]}
        </span>
        <span>
          {forecast?.date ? (
            shortDate(forecast.date, true)
          ) : forecast?.count === 0 ? (
            <Check size={14} />
          ) : (
            ""
          )}
        </span>
      </span>
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
export function AmountInput({
  value,
  onChange,
  label = "Amount",
  required = true,
  min = "0",
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      type="number"
      min={min}
      max="999999999.99"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/^0+(?=\d)/, ""))}
      required={required}
    />
  );
}
const editablePercent = (n: number) =>
  Number.isFinite(n) ? String(Number(n.toPrecision(12))) : "";
export function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(() => editablePercent(value));
  useEffect(() => {
    setText((current) =>
      Number(current) === value ? current : editablePercent(value),
    );
  }, [value]);
  return (
    <Input
      aria-label={label}
      type="number"
      inputMode="decimal"
      min="0"
      max="100"
      step="any"
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/^0+(?=\d)/, "");
        const bounded = Math.max(0, Math.min(100, Number(next)));
        setText(next && Number(next) !== bounded ? String(bounded) : next);
        onChange(bounded);
      }}
      onBlur={() => {
        if (!text) setText("0");
      }}
    />
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function AddLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <Plus size={18} />
      {children}
    </>
  );
}

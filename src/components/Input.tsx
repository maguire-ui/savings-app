import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

// Number inputs cannot set a caret in Safari. A text field with a numeric
// keyboard gives us a reliable end position; keep its original constraints.
function numberError(
  input: HTMLInputElement,
  min?: string | number,
  max?: string | number,
  step?: string | number,
) {
  const text = input.value.trim();
  if (!text) return ""; // Native required validation handles an empty field.
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
    !Number.isFinite(Number(text))
  )
    return "Enter a valid number.";
  const value = Number(text);
  if (min !== undefined && value < Number(min)) return `Enter ${min} or more.`;
  if (max !== undefined && value > Number(max)) return `Enter ${max} or less.`;
  if (step !== "any") {
    const increment = Number(step ?? 1);
    const count = (value - Number(min ?? 0)) / increment;
    if (
      increment > 0 &&
      Math.abs(count - Math.round(count)) >
        Number.EPSILON * Math.max(1, Math.abs(count)) * 16
    )
      return `Use increments of ${increment}.`;
  }
  return "";
}

export function Input({
  type = "text",
  value,
  min,
  max,
  step,
  inputMode,
  onChange,
  onClick,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  const frame = useRef<number | undefined>(undefined);
  const numeric = type === "number";
  // Let number-valued parents receive a number without deleting the user's
  // empty field or unfinished decimal while they are typing.
  const [numberText, setNumberText] = useState(String(value ?? ""));
  const localNumber = numeric && typeof value === "number";
  useEffect(() => {
    if (localNumber && Number.isFinite(value))
      setNumberText((current) =>
        Number(current) === value ? current : String(value),
      );
  }, [localNumber, value]);
  const displayed = localNumber ? numberText : value;
  useEffect(() => {
    if (numeric && input.current)
      input.current.setCustomValidity(
        numberError(input.current, min, max, step),
      );
  }, [numeric, displayed, min, max, step]);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  function end(field: HTMLInputElement) {
    if (!["text", "search", "tel", "url", "password"].includes(field.type))
      return;
    const move = () => {
      if (document.activeElement === field)
        field.setSelectionRange(field.value.length, field.value.length);
    };
    move();
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    // iOS can apply its touch selection after the click; settle it once.
    frame.current = requestAnimationFrame(move);
  }
  return (
    <input
      {...props}
      ref={input}
      type={numeric ? "text" : type}
      inputMode={
        inputMode ??
        (numeric
          ? step === "any" || !Number.isInteger(Number(step ?? 1))
            ? "decimal"
            : "numeric"
          : undefined)
      }
      value={displayed}
      min={min}
      max={max}
      step={step}
      onClick={(event) => {
        onClick?.(event);
        end(event.currentTarget);
      }}
      onChange={(event) => {
        if (localNumber)
          setNumberText(event.currentTarget.value.replace(/^0+(?=\d)/, ""));
        if (numeric)
          event.currentTarget.setCustomValidity(
            numberError(event.currentTarget, min, max, step),
          );
        onChange?.(event);
      }}
    />
  );
}

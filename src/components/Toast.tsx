import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ToastNotice = { id: number; message: string };

export function Toast({
  notice,
  onDismiss,
  role = "status",
}: {
  notice: ToastNotice | null;
  onDismiss: (id: number) => void;
  role?: "status" | "alert";
}) {
  // Retain the last message until its exit animation finishes.
  const [displayed, setDisplayed] = useState(notice);
  const element = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const phase = useRef<"hidden" | "entering" | "shown" | "leaving">("hidden");

  useEffect(() => {
    if (notice) setDisplayed(notice);
  }, [notice]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => onDismiss(notice.id), 4500);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  useLayoutEffect(() => {
    if (!displayed) {
      animation.current?.cancel();
      animation.current = null;
      return;
    }
    const node = element.current;
    if (!node || (notice && displayed.id !== notice.id)) return;
    const showing = Boolean(notice);
    // Consecutive saves update the message and restart its timer in place.
    if (showing && (phase.current === "shown" || phase.current === "entering"))
      return;
    const style = getComputedStyle(node);
    const belowScreen = `translate(-50%, ${node.offsetHeight + parseFloat(style.bottom) + 16}px)`;
    const from =
      phase.current === "hidden"
        ? { transform: belowScreen, opacity: 0 }
        : { transform: style.transform, opacity: Number(style.opacity) };
    animation.current?.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation.current = null;
      phase.current = showing ? "shown" : "hidden";
      if (!showing) setDisplayed(null);
      return;
    }
    const motion = node.animate(
      [
        from,
        showing
          ? { transform: "translate(-50%, 0)", opacity: 1 }
          : { transform: belowScreen, opacity: 0 },
      ],
      {
        duration: showing ? 280 : 220,
        easing: showing
          ? "cubic-bezier(0.22, 1, 0.36, 1)"
          : "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
      },
    );
    animation.current = motion;
    phase.current = showing ? "entering" : "leaving";
    void motion.finished
      .then(() => {
        if (animation.current !== motion) return;
        phase.current = showing ? "shown" : "hidden";
        if (showing) {
          motion.cancel();
          animation.current = null;
        } else setDisplayed(null);
      })
      .catch(() => {
        /* A new message can smoothly reverse a dismissal. */
      });
  }, [notice, displayed]);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (media.matches) animation.current?.finish();
    };
    media.addEventListener("change", changed);
    return () => {
      media.removeEventListener("change", changed);
      animation.current?.cancel();
    };
  }, []);

  return displayed ? (
    <div
      ref={element}
      role={role}
      aria-atomic="true"
      aria-hidden={!notice}
      className="toast"
      style={{ pointerEvents: notice ? "auto" : "none" }}
      onClick={() => {
        if (notice) onDismiss(notice.id);
      }}
    >
      <span key={displayed.id}>{displayed.message}</span>
    </div>
  ) : null;
}

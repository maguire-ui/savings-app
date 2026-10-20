import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export type UpdateStatus =
  "idle" | "checking" | "current" | "ready" | "offline" | "error" | "applying";

function waitForInstall(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => finish(new Error("Update download timed out.")),
      15000,
    );
    function finish(error?: Error) {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", changed);
      error ? reject(error) : resolve();
    }
    function changed() {
      if (worker.state === "redundant")
        finish(new Error("Update download failed."));
      else if (worker.state === "installed" || worker.state === "activated")
        finish();
    }
    worker.addEventListener("statechange", changed);
    changed();
  });
}
function withTimeout<T>(work: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Update check timed out.")),
      15000,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function useAppUpdates() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>(),
    [status, setStatus] = useState<UpdateStatus>("idle"),
    [message, setMessage] = useState(""),
    [registrationError, setRegistrationError] = useState("");
  const checking = useRef(false),
    applying = useRef(false),
    reloadIssued = useRef(false),
    lastCheck = useRef(0),
    applyTimer = useRef<number | undefined>(undefined);
  const reloadAfterUpdate = useCallback(() => {
    if (applying.current && !reloadIssued.current) {
      reloadIssued.current = true;
      window.location.reload();
    }
  }, []);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    immediate: true,
    // Workbox can classify a quickly discovered worker as external. Reload only
    // after the user applies, regardless of that timing heuristic.
    onNeedReload: reloadAfterUpdate,
    onRegisteredSW: (_url, r) => {
      if (r) setRegistration(r);
    },
    onRegisterError: () => {
      setRegistrationError(
        "Offline download failed. Reconnect and reopen the app to try again.",
      );
    },
  });
  useEffect(() => {
    if (needRefresh && !applying.current) setStatus("ready");
  }, [needRefresh]);

  const checkForUpdates = useCallback(
    async (manual = true) => {
      if (checking.current || applying.current) return;
      if (
        !manual &&
        (document.visibilityState === "hidden" ||
          Date.now() - lastCheck.current < 60000)
      )
        return;
      if (!navigator.onLine) {
        if (manual) {
          setStatus("offline");
          setMessage(
            "Connect to the internet to check for updates. Your saved plan is still available.",
          );
        }
        return;
      }
      checking.current = true;
      lastCheck.current = Date.now();
      setStatus("checking");
      setMessage("");
      try {
        const available = await withTimeout(
          (async () => {
            if (!("serviceWorker" in navigator))
              throw new Error("Updates aren’t supported in this browser.");
            const r = await navigator.serviceWorker.getRegistration();
            if (!r)
              throw new Error(
                "Offline access is still preparing. Try again in a moment.",
              );
            if (r.waiting) return true;
            // An explicit uncached request distinguishes a successful check from an unreachable server.
            const script = r.active?.scriptURL || r.installing?.scriptURL;
            if (!script)
              throw new Error(
                "Offline access is still preparing. Try again in a moment.",
              );
            const response = await fetch(script, { cache: "no-store" });
            if (!response.ok)
              throw new Error("The update server is unavailable.");
            if (r.installing) await waitForInstall(r.installing);
            await r.update();
            if (r.installing) await waitForInstall(r.installing);
            return Boolean(r.waiting);
          })(),
        );
        setRegistrationError("");
        if (available) {
          setNeedRefresh(true);
          setStatus("ready");
        } else setStatus("current");
      } catch {
        setStatus("error");
        setMessage(
          "Couldn’t check for updates. Check your connection and try again. Your saved plan hasn’t changed.",
        );
      } finally {
        checking.current = false;
      }
    },
    [setNeedRefresh],
  );

  useEffect(() => {
    if (!registration) return;
    const resume = () => {
      void checkForUpdates(false);
    };
    const reconnect = () => {
      lastCheck.current = 0;
      resume();
    };
    resume();
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [registration, checkForUpdates]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let hadController = Boolean(navigator.serviceWorker.controller);
    const changed = () => {
      if (applying.current) reloadAfterUpdate();
      else if (hadController) setNeedRefresh(true);
      hadController = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
  }, [reloadAfterUpdate, setNeedRefresh]);
  useEffect(() => () => clearTimeout(applyTimer.current), []);

  async function applyUpdate() {
    if (applying.current || !needRefresh) return;
    applying.current = true;
    setStatus("applying");
    const failed = () => {
      applying.current = false;
      setStatus("error");
      setMessage(
        "The update hasn’t opened yet. Try Update again, or fully close and reopen Savings. Your saved plan stays here.",
      );
    };
    applyTimer.current = window.setTimeout(failed, 15000);
    try {
      const r = await navigator.serviceWorker.getRegistration();
      if (r?.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
      else reloadAfterUpdate();
    } catch {
      clearTimeout(applyTimer.current);
      failed();
    }
  }
  return {
    offlineReady: offlineReady || Boolean(registration?.active),
    needRefresh,
    status,
    message,
    registrationError,
    checkForUpdates,
    applyUpdate,
  };
}
export type AppUpdates = ReturnType<typeof useAppUpdates>;

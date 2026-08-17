import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { installObservabilitySinks } from "./lib/observability/bootstrap";

// OPS-002: inicialização segura de error tracking.
// No-op se VITE_SENTRY_DSN não estiver setado.
initSentry();
// OPS-003.slice-02: plugar sinks de logging estruturado (console em dev,
// Sentry breadcrumb quando habilitado). Idempotente.
installObservabilitySinks();

// Recarrega automaticamente quando um chunk dinâmico some entre deploys
// (evita "Failed to fetch dynamically imported module" após republish).
if (typeof window !== "undefined") {
  const reloadOnStaleChunk = (reason: string) => {
    const key = "planifik:chunk-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? "0");
    if (Date.now() - last < 10_000) return; // evita loop
    sessionStorage.setItem(key, String(Date.now()));
    console.warn("[planifik] chunk stale, recarregando:", reason);
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnStaleChunk("vite:preloadError");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e.reason?.message ?? e.reason ?? "");
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      reloadOnStaleChunk(msg);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);

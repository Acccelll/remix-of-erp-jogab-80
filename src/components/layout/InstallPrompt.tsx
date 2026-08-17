/**
 * Prompt de instalação PWA (OFF.3).
 *
 * Captura o evento `beforeinstallprompt` (Chrome/Edge/Android) e expõe um
 * botão discreto no header. Em iOS Safari o evento não existe — mostramos
 * uma dica curta uma única vez (persistida em localStorage) quando o app
 * está rodando no Safari e ainda não foi adicionado à home screen.
 *
 * Não renderiza nada quando o app já está instalado (`display-mode:
 * standalone`) ou quando o usuário descartou o convite.
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = STORAGE_KEYS.pwaInstallDismissed;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIOSSafari()) setIosHint(true);

    const onInstalled = () => {
      setDeferred(null);
      setIosHint(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [dismissed]);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "dismissed") dismiss();
    setDeferred(null);
  };

  if (dismissed || isStandalone()) return null;

  if (deferred) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={install}
        className="h-7 px-2 text-xs gap-1.5"
        title="Adicionar à tela inicial para uso em campo"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Instalar app</span>
      </Button>
    );
  }

  if (iosHint) {
    return (
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 hidden md:inline-flex items-center gap-1"
        title="Toque em Compartilhar → Adicionar à Tela de Início"
      >
        <Download className="h-3.5 w-3.5" />
        Instalar (Compartilhar → Tela de Início)
      </button>
    );
  }

  return null;
}

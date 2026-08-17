/** @module-kind io */
import { useEffect } from "react";

export interface BoardHotkeysHandlers {
  onFocusSearch?: () => void;
  onClearSelection?: () => void;
  onSelectAllVisible?: () => void;
  onOpenMove?: () => void;
  enabled?: boolean;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useBoardHotkeys({
  onFocusSearch,
  onClearSelection,
  onSelectAllVisible,
  onOpenMove,
  enabled = true,
}: BoardHotkeysHandlers) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const typing = isTypingTarget(e.target);
      if (e.key === "Escape") {
        onClearSelection?.();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        onSelectAllVisible?.();
        return;
      }
      if (e.key.toLowerCase() === "m") {
        onOpenMove?.();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onFocusSearch, onClearSelection, onSelectAllVisible, onOpenMove]);
}

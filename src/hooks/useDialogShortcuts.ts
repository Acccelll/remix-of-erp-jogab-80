import { useEffect, RefObject } from "react";

/**
 * Atalhos globais para diálogos/formulários:
 * - Enter em <input>: avança para o próximo campo focável
 * - Ctrl/Cmd+S: aciona o botão primário (último botão não-outline do DialogFooter)
 * - Esc: fechado nativamente pelo Radix Dialog
 * - Tab/Shift+Tab: nativo
 *
 * Ignora Enter dentro de <textarea>, <button>, [role="combobox"] aberto e [contenteditable].
 */
export function useDialogShortcuts(containerRef: RefObject<HTMLElement>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    const FOCUSABLE =
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el.getClientRects().length > 0,
      );

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Ctrl/Cmd+S → submit
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const footer = root.querySelector<HTMLElement>("[data-dialog-footer], .dialog-footer");
        const buttons = Array.from(
          (footer || root).querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        );
        // O primário tipicamente é o último (após "Cancelar")
        const primary = buttons[buttons.length - 1];
        primary?.click();
        return;
      }

      // Enter → próximo campo (exceto textarea/botão/combobox)
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = target.tagName.toLowerCase();
        const role = target.getAttribute("role");
        const isTextarea = tag === "textarea";
        const isButton = tag === "button" || role === "button";
        const isCombobox = role === "combobox";
        const isContentEditable = target.isContentEditable;

        if (isTextarea || isButton || isCombobox || isContentEditable) return;
        if (tag !== "input") return;

        e.preventDefault();
        const focusable = getFocusable();
        const idx = focusable.indexOf(target);
        if (idx === -1) return;

        // Procura próximo input/select/textarea/combobox (pula botões)
        for (let i = idx + 1; i < focusable.length; i++) {
          const el = focusable[i];
          const t = el.tagName.toLowerCase();
          const r = el.getAttribute("role");
          if (t === "input" || t === "select" || t === "textarea" || r === "combobox") {
            el.focus();
            if (
              el instanceof HTMLInputElement &&
              el.type !== "checkbox" &&
              el.type !== "radio" &&
              el.type !== "date"
            ) {
              el.select?.();
            }
            return;
          }
        }
        // Se não há próximo campo, foca no botão primário do footer
        const footer = root.querySelector<HTMLElement>("[data-dialog-footer]");
        const buttons = Array.from(
          (footer || root).querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        );
        buttons[buttons.length - 1]?.focus();
      }
    };

    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  }, [containerRef, enabled]);
}

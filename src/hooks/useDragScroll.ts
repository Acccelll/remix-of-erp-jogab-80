import { useEffect, useRef } from "react";

/**
 * Click-and-drag horizontal panning on an overflow container.
 * Skips when the press starts on an interactive element (button, link,
 * input, draggable card, etc.) so it never steals from @dnd-kit or clicks.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const isInteractive = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      return !!node.closest(
        'button, a, input, textarea, select, [role="button"], [data-dnd-handle], [data-no-pan], .pan-card, [draggable="true"]',
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.classList.add("is-panning");
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startScroll - dx;
    };
    const stop = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("is-panning");
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
}

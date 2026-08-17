import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { useBoardHotkeys } from "@/lib/quadros/useBoardHotkeys";

function Harness(props: Parameters<typeof useBoardHotkeys>[0]) {
  useBoardHotkeys(props);
  return <input data-testid="typing-target" />;
}

function fireKey(opts: { key: string; ctrl?: boolean; meta?: boolean; target?: EventTarget }) {
  const ev = new KeyboardEvent("keydown", {
    key: opts.key,
    ctrlKey: !!opts.ctrl,
    metaKey: !!opts.meta,
    bubbles: true,
    cancelable: true,
  });
  (opts.target ?? window).dispatchEvent(ev);
  return ev;
}

describe("useBoardHotkeys", () => {
  it("dispara onFocusSearch ao apertar '/' fora de input", () => {
    const onFocusSearch = vi.fn();
    render(<Harness onFocusSearch={onFocusSearch} />);
    const ev = fireKey({ key: "/" });
    expect(onFocusSearch).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ignora atalhos exceto Escape quando o foco está em input", () => {
    const onFocusSearch = vi.fn();
    const onClearSelection = vi.fn();
    const { getByTestId } = render(
      <Harness onFocusSearch={onFocusSearch} onClearSelection={onClearSelection} />,
    );
    const input = getByTestId("typing-target");
    input.focus();
    fireKey({ key: "/", target: input });
    expect(onFocusSearch).not.toHaveBeenCalled();
    fireKey({ key: "Escape", target: input });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("dispara onSelectAllVisible com Ctrl/Cmd+A e onOpenMove com 'm'", () => {
    const onSelectAllVisible = vi.fn();
    const onOpenMove = vi.fn();
    render(<Harness onSelectAllVisible={onSelectAllVisible} onOpenMove={onOpenMove} />);
    fireKey({ key: "a", ctrl: true });
    fireKey({ key: "m" });
    expect(onSelectAllVisible).toHaveBeenCalledTimes(1);
    expect(onOpenMove).toHaveBeenCalledTimes(1);
  });

  it("não dispara nada quando enabled=false", () => {
    const onFocusSearch = vi.fn();
    render(<Harness onFocusSearch={onFocusSearch} enabled={false} />);
    fireKey({ key: "/" });
    expect(onFocusSearch).not.toHaveBeenCalled();
  });
});

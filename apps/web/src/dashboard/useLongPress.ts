import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

/** How long a press must last to count as long (docs/DESIGN-V2.md, 3). */
export const LONG_PRESS_MS = 450;
/** Moving further than this (px) is scrolling or dragging, not pressing; a mouse hand wobbles more than it scrolls. */
const MOVE_TOLERANCE = { touch: 10, mouse: 24 };
/** A click belonging to a press comes right after pointerup; later the swallowing ends (e.g. sheet closed, Enter). */
const SWALLOW_MS = 400;

/**
 * Tap and long press on one element (a button). `onPress`: tap, click, Enter/Space. `onLongPress`: held 450 ms, right
 * click, the context menu key or Shift+F10 (the last three arrive as "contextmenu"). After a long press the click
 * that follows is swallowed, so it does not also switch; moving the finger (scrolling) or pointercancel cancels both.
 */
export function useLongPress({ onPress, onLongPress, ms = LONG_PRESS_MS }: { onPress: () => void; onLongPress: () => void; ms?: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Where the current press started; null when no press is running. */
  const start = useRef<{ x: number; y: number; tolerance: number } | null>(null);
  const swallowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The long press of the current press has fired (a touch "contextmenu" right after it is then ignored). */
  const fired = useRef(false);
  /** The next click belongs to a long press or a cancelled press and does nothing. */
  const swallowClick = useRef(false);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(swallowTimer.current);
    },
    [],
  );
  /** Stop swallowing a moment after the press ended, if no click came. */
  const endSwallowSoon = () => {
    clearTimeout(swallowTimer.current);
    swallowTimer.current = setTimeout(() => {
      swallowClick.current = false;
    }, SWALLOW_MS);
  };

  const stop = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  const fire = () => {
    // Only a running press (finger or mouse held) is followed by a click to swallow; right click and the keyboard
    // are not, and must not block the next Enter.
    const pressing = start.current !== null;
    stop();
    fired.current = pressing;
    swallowClick.current = pressing;
    onLongPress();
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      fired.current = false;
      swallowClick.current = false;
      // only the primary button; the right one ends up as "contextmenu"
      if (event.button !== 0) {
        return;
      }
      start.current = { x: event.clientX, y: event.clientY, tolerance: event.pointerType === 'mouse' ? MOVE_TOLERANCE.mouse : MOVE_TOLERANCE.touch };
      clearTimeout(timer.current);
      timer.current = setTimeout(fire, ms);
    },
    onPointerMove: (event: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(event.clientX - s.x, event.clientY - s.y) > s.tolerance) {
        stop();
        swallowClick.current = true;
      }
    },
    onPointerUp: () => {
      stop();
      fired.current = false;
      endSwallowSoon();
    },
    onPointerCancel: () => {
      // the browser took over (scrolling)
      stop();
      swallowClick.current = true;
      endSwallowSoon();
    },
    onKeyDown: (event: KeyboardEvent) => {
      // a key press is a new press: Enter/Space must work even if a long press was the last thing
      if (event.key === 'Enter' || event.key === ' ') {
        swallowClick.current = false;
      }
    },
    onPointerLeave: () => stop(),
    onClick: (event: MouseEvent) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        event.preventDefault();
        return;
      }
      onPress();
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      if (!fired.current) {
        fire();
      }
    },
  };
}

import { useCallback, useEffect, useState } from 'react';

import { defaultLayout, parseLayout, type DashboardLayout } from '@smarthome/core';

/** Key of the layout in localStorage, per user (docs/DESIGN-V2.md, 2). */
export const layoutKey = (userId: number | string) => `smarthome.layout.${userId}`;

function load(userId: number | undefined): DashboardLayout {
  if (userId === undefined) {
    return defaultLayout();
  }
  try {
    return parseLayout(localStorage.getItem(layoutKey(userId)));
  } catch {
    // storage blocked (private mode, policies): the default, nothing saved
    return defaultLayout();
  }
}

/**
 * The signed-in user's dashboard layout from localStorage, and `save` to change it. Until the user is known
 * (`userId` undefined) the default, and nothing is written.
 */
export function useDashboardLayout(userId: number | undefined) {
  const [state, setState] = useState(() => ({ userId, layout: load(userId) }));
  // Another user (or the user id arriving): load their layout; adjusting state during render, as React recommends
  let current = state;
  if (state.userId !== userId) {
    current = { userId, layout: load(userId) };
    setState(current);
  }

  const save = useCallback(
    (layout: DashboardLayout) => {
      setState({ userId, layout });
      if (userId !== undefined) {
        try {
          localStorage.setItem(layoutKey(userId), JSON.stringify(layout));
        } catch {
          // full or blocked: the layout still applies until the page is reloaded
        }
      }
    },
    [userId],
  );

  // Other tabs of the same user
  useEffect(() => {
    if (userId === undefined) {
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === layoutKey(userId)) {
        setState({ userId, layout: parseLayout(event.newValue) });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  return { layout: current.layout, save };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { defaultLayout, parseLayout, type DashboardLayout } from '@smarthome/core';

/** Key of the layout in AsyncStorage, per user, like the web's localStorage key (docs/DESIGN-V2.md, 2). */
export const layoutKey = (userId: number | string) => `smarthome.layout.${userId}`;

/**
 * The signed-in user's dashboard layout from AsyncStorage, and `save` to change it. `loaded` turns true once read
 * (until then the default, so the list does not jump twice); nothing is written while the user is unknown.
 */
export function useDashboardLayout(userId: number | undefined) {
  const [state, setState] = useState<{ userId: number | undefined; layout: DashboardLayout; loaded: boolean }>({
    userId: undefined,
    layout: defaultLayout(),
    loaded: false,
  });

  useEffect(() => {
    if (userId === undefined) {
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(layoutKey(userId))
      .then((json) => !cancelled && setState({ userId, layout: parseLayout(json), loaded: true }))
      // unreadable: the default
      .catch(() => !cancelled && setState({ userId, layout: defaultLayout(), loaded: true }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    (layout: DashboardLayout) => {
      setState({ userId, layout, loaded: true });
      if (userId !== undefined) {
        AsyncStorage.setItem(layoutKey(userId), JSON.stringify(layout)).catch(() => {
          // full or broken storage: the layout still applies until the app is restarted
        });
      }
    },
    [userId],
  );

  // another user's layout (account switch) is not shown, not even for a moment
  const current = state.userId === userId ? state : { userId, layout: defaultLayout(), loaded: false };
  return { layout: current.layout, loaded: current.loaded, save };
}

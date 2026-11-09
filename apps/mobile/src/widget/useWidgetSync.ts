import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { HomescreenItem } from '@smarthome/core';
import { appearanceColors, type Appearance } from '@smarthome/theme';

import { rememberTiles } from './data';
import { updateQuickSwitchWidget } from './widgetTaskHandler';

/**
 * Keeps the home screen widget in step with the app: when the tiles the server's data gives (selection, order, state,
 * availability) or the colour world change, and when the app goes to the background. Only redraws when what the widget
 * shows changed. `items` is undefined until the data is there (or while the server cannot be reached): then nothing is
 * drawn over what the widget has.
 */
export function useWidgetSync(items: HomescreenItem[] | undefined, appearance: Appearance) {
  const last = useRef('');
  const signature = items ? JSON.stringify([items, appearance]) : '';

  useEffect(() => {
    if (!items || signature === last.current) {
      return;
    }
    last.current = signature;
    const colors = { light: appearanceColors(appearance, false).colors, dark: appearanceColors(appearance, true).colors };
    void rememberTiles(items);
    void updateQuickSwitchWidget({ kind: 'ok', items, colors }).catch(() => {});
    // items and appearance are covered by the signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        void updateQuickSwitchWidget().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
}

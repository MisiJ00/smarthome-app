import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Device } from '@smarthome/api-client';
import { deviceKey, type DashboardLayout } from '@smarthome/core';
import { appearanceColors, type Appearance } from '@smarthome/theme';

import { toItem } from './data';
import { updateQuickSwitchWidget } from './widgetTaskHandler';

/**
 * Keeps the home screen widget in step with the app: on live changes of the widget's devices, on layout changes
 * (stars), on a new colour world, and when the app goes to the background. Only redraws when what the widget shows
 * changed (a power reading of another device does not).
 */
export function useWidgetSync(devices: Device[] | undefined, layout: DashboardLayout, loaded: boolean, appearance: Appearance) {
  const last = useRef('');
  const byId = new Map((devices ?? []).map((d) => [deviceKey(d), d]));
  const items = devices && loaded ? layout.widget.map((id) => byId.get(id)).filter((d): d is Device => d !== undefined).map(toItem) : undefined;
  const signature = items ? JSON.stringify([items, appearance]) : '';

  useEffect(() => {
    if (!items || signature === last.current) {
      return;
    }
    last.current = signature;
    const colors = { light: appearanceColors(appearance, false).colors, dark: appearanceColors(appearance, true).colors };
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

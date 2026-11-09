import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';

import type { Device } from '@smarthome/api-client';
import { deviceItem, unavailableItem } from '@smarthome/core';
import { appearanceColors, type Appearance } from '@smarthome/theme';

import { pruneSingleBindings, rememberSingle, SINGLE_WIDGET_NAME, singleDeviceOf } from './single';
import { renderSingle, updateSingleDeviceWidgets } from './widgetTaskHandler';

/**
 * Keeps the single device widgets in step with the app while it runs: each instance is drawn from the devices the app
 * already has (live state, and "not visible" when the device is not in the list of the devices the person may see).
 * Only the instances whose tile changed are drawn again, each by its own id, so instances and the quick switch never
 * disturb each other. `devices` is undefined until the list is there: then nothing is drawn over what the widgets show.
 */
export function useSingleWidgetSync(devices: Device[] | undefined, appearance: Appearance) {
  const drawn = useRef(new Map<number, string>());

  useEffect(() => {
    if (Platform.OS !== 'android' || !devices) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const instances = await getWidgetInfo(SINGLE_WIDGET_NAME);
        if (cancelled) {
          return;
        }
        await pruneSingleBindings(instances.map((i) => i.widgetId));
        const colors = { light: appearanceColors(appearance, false).colors, dark: appearanceColors(appearance, true).colors };
        for (const instance of instances) {
          const deviceId = await singleDeviceOf(instance.widgetId);
          if (deviceId === undefined) {
            continue;
          }
          const device = devices.find((d) => d.id === deviceId);
          const item = device ? deviceItem(device) : unavailableItem(deviceId);
          const key = JSON.stringify([item, appearance, instance.width]);
          if (drawn.current.get(instance.widgetId) === key) {
            continue;
          }
          drawn.current.set(instance.widgetId, key);
          void rememberSingle(instance.widgetId, item);
          void requestWidgetUpdateById({
            widgetName: SINGLE_WIDGET_NAME,
            widgetId: instance.widgetId,
            renderWidget: (info) => renderSingle({ kind: 'ok', item, colors }, info.width),
          }).catch(() => {});
        }
      })().catch(() => {});
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [devices, appearance]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        drawn.current.clear();
        void updateSingleDeviceWidgets().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
}

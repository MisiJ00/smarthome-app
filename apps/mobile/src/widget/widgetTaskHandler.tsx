import { Platform } from 'react-native';
import { getWidgetInfo, requestWidgetUpdate, requestWidgetUpdateById, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { decideTap } from '@smarthome/core';
import { appearanceColors, DEFAULT_APPEARANCE } from '@smarthome/theme';

import { loadColors, loadWidgetData, widgetApi, type WidgetData } from './data';
import { QuickSwitchWidget, TOGGLE, WIDGET_NAME } from './QuickSwitchWidget';
import { SingleDeviceWidget } from './SingleDeviceWidget';
import { loadSingle, pruneSingleBindings, SINGLE_WIDGET_NAME, singleDeviceOf, unbindSingleDevice, type SingleData } from './single';

/** The widget in light and dark (the launcher picks by the system's mode), from loaded data. */
function render(data: WidgetData, busyId?: string) {
  const colors = data.kind === 'signedOut' ? undefined : data.colors;
  return {
    light: <QuickSwitchWidget data={data} colors={colors?.light ?? fallback.light} busyId={busyId} />,
    dark: <QuickSwitchWidget data={data} colors={colors?.dark ?? fallback.dark} busyId={busyId} />,
  };
}

/** One single device widget instance in light and dark; `width` (dp) decides between the narrow and the wide layout. */
export function renderSingle(data: SingleData, width: number, busy?: boolean) {
  const colors = data.kind === 'signedOut' ? undefined : data.colors;
  return {
    light: <SingleDeviceWidget data={data} colors={colors?.light ?? fallback.light} width={width} busy={busy} />,
    dark: <SingleDeviceWidget data={data} colors={colors?.dark ?? fallback.dark} width={width} busy={busy} />,
  };
}

// Without login there are no stored colours to read either: the default colour world
const fallback = { light: appearanceColors(DEFAULT_APPEARANCE, false).colors, dark: appearanceColors(DEFAULT_APPEARANCE, true).colors };

/**
 * Runs headless for the widgets (registered in index.ts): draws them when added, updated or resized, and switches a
 * device on a tap (session from SecureStore → JWT → command), then draws them again with the new state.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName === SINGLE_WIDGET_NAME) {
    await singleTaskHandler(props);
    return;
  }
  if (props.widgetInfo.widgetName !== WIDGET_NAME) {
    return;
  }
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(render(await loadWidgetData()));
      break;
    case 'WIDGET_CLICK':
      if (props.clickAction === TOGGLE) {
        await toggle(props);
      }
      break;
    default:
      break;
  }
}

/** How long the "not reachable" state stays on the widget after a failed tap before it shows the devices again. */
const ERROR_MS = 2500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TapData = { id?: string; deviceId?: number; command?: Record<string, unknown> };

/** Sends the command of a tap: undefined when it went out, otherwise why not (the backend's rights check decides). */
async function sendCommand(api: NonNullable<Awaited<ReturnType<typeof widgetApi>>>, deviceId: number, command: Record<string, unknown>): Promise<'signedOut' | 'error' | undefined> {
  try {
    const { data: result, response } = await api.POST('/api/devices/{id}/commands', { params: { path: { id: deviceId } }, body: command });
    if (response.status === 401) {
      return 'signedOut';
    }
    // 403 (no right any more), a locked action, or an action that needs an approval after all: the app handles those
    return !response.ok || result?.status === 'confirmation_required' ? 'error' : undefined;
  } catch {
    return 'error';
  }
}

/** One client (one Kratos round trip) for a whole tap; a failed setup is the same as a failed command. */
async function clientForTap(): Promise<Awaited<ReturnType<typeof widgetApi>> | undefined> {
  try {
    return await widgetApi();
  } catch {
    return undefined;
  }
}

async function toggle(props: WidgetTaskHandlerProps) {
  const data = props.clickActionData as TapData | undefined;
  if (!data?.deviceId || !data.command) {
    return;
  }
  const api = await clientForTap();
  if (api === null) {
    props.renderWidget(render({ kind: 'signedOut' }));
    return;
  }
  // The tile may be older than the server's state: load again first and only send when this same widget still shows
  // this same device and can be switched (the tap is bound to the ids it was drawn with, never to a position)
  const fresh = await loadWidgetData(api);
  if (fresh.kind !== 'ok' || !decideTap({ id: data.id ?? '', deviceId: data.deviceId }, fresh.items).send) {
    props.renderWidget(render(fresh));
    return;
  }
  props.renderWidget(render(fresh, data.id));
  const failure = api ? await sendCommand(api, data.deviceId, data.command) : 'error';
  if (failure === 'signedOut') {
    props.renderWidget(render({ kind: 'signedOut' }));
    return;
  }
  if (failure === 'error') {
    props.renderWidget(render({ kind: 'error', colors: await loadColors() }));
    await sleep(ERROR_MS);
  } else {
    // the device reports its new state a moment later
    await sleep(700);
  }
  props.renderWidget(render(await loadWidgetData(api)));
}

/** The single device widgets: one instance, one device, same rules as the quick switch tiles. */
async function singleTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetId, width } = props.widgetInfo;
  switch (props.widgetAction) {
    case 'WIDGET_DELETED':
      await unbindSingleDevice(widgetId);
      break;
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderSingle(await loadSingle(widgetId), width));
      break;
    case 'WIDGET_CLICK':
      if (props.clickAction === TOGGLE) {
        await toggleSingle(props);
      }
      break;
    default:
      break;
  }
}

async function toggleSingle(props: WidgetTaskHandlerProps) {
  const { widgetId, width } = props.widgetInfo;
  const data = props.clickActionData as TapData | undefined;
  if (!data?.deviceId || !data.command) {
    return;
  }
  const draw = (single: SingleData, busy?: boolean) => props.renderWidget(renderSingle(single, width, busy));
  const api = await clientForTap();
  if (api === null) {
    draw({ kind: 'signedOut' });
    return;
  }
  // Same guard as the quick switch: the instance must still belong to this device (it can be changed later) and the
  // freshly loaded device must be available and switchable; otherwise only redraw
  const fresh = await loadSingle(widgetId, api);
  if (
    fresh.kind !== 'ok' ||
    (await singleDeviceOf(widgetId)) !== data.deviceId ||
    !decideTap({ id: data.id ?? '', deviceId: data.deviceId }, [fresh.item]).send
  ) {
    draw(fresh);
    return;
  }
  draw(fresh, true);
  const failure = api ? await sendCommand(api, data.deviceId, data.command) : 'error';
  if (failure === 'signedOut') {
    draw({ kind: 'signedOut' });
    return;
  }
  if (failure === 'error') {
    draw({ kind: 'error', colors: await loadColors() });
    await sleep(ERROR_MS);
  } else {
    await sleep(700);
  }
  draw(await loadSingle(widgetId, api));
}

/**
 * Draws the quick switch again. The app passes what it already has (the tiles from the server's data and the colours),
 * so a live change costs no extra request; without data the widget loads it itself.
 */
export async function updateQuickSwitchWidget(data?: WidgetData) {
  if (Platform.OS !== 'android') {
    return;
  }
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: async () => render(data ?? (await loadWidgetData())) });
}

/**
 * Draws all single device widgets again (each instance by its own id, so they never touch each other or the quick
 * switch). Also drops the assignments of instances that are gone.
 */
export async function updateSingleDeviceWidgets() {
  if (Platform.OS !== 'android') {
    return;
  }
  const instances = await getWidgetInfo(SINGLE_WIDGET_NAME);
  await pruneSingleBindings(instances.map((i) => i.widgetId));
  await Promise.all(
    instances.map((i) =>
      requestWidgetUpdateById({
        widgetName: SINGLE_WIDGET_NAME,
        widgetId: i.widgetId,
        renderWidget: async (info) => renderSingle(await loadSingle(i.widgetId), info.width),
      }),
    ),
  );
}

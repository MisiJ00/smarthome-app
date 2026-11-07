import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { appearanceColors, DEFAULT_APPEARANCE } from '@smarthome/theme';

import { loadColors, loadWidgetData, widgetApi, type WidgetData } from './data';
import { QuickSwitchWidget, TOGGLE, WIDGET_NAME } from './QuickSwitchWidget';

/** The widget in light and dark (the launcher picks by the system's mode), from loaded data. */
function render(data: WidgetData, busyId?: string) {
  const colors = data.kind === 'signedOut' ? undefined : data.colors;
  return {
    light: <QuickSwitchWidget data={data} colors={colors?.light ?? fallback.light} busyId={busyId} />,
    dark: <QuickSwitchWidget data={data} colors={colors?.dark ?? fallback.dark} busyId={busyId} />,
  };
}

// Without login there are no stored colours to read either: the default colour world
const fallback = { light: appearanceColors(DEFAULT_APPEARANCE, false).colors, dark: appearanceColors(DEFAULT_APPEARANCE, true).colors };

/**
 * Runs headless for the widget (registered in index.ts): draws it when added, updated or resized, and switches a
 * device on a tap (session from SecureStore → JWT → command), then draws it again with the new state.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
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

async function toggle(props: WidgetTaskHandlerProps) {
  const data = props.clickActionData as { id?: string; deviceId?: number; command?: Record<string, unknown> } | undefined;
  if (!data?.deviceId || !data.command) {
    return;
  }
  // one client (one Kratos round trip) for the whole tap; a failed setup is the same as a failed command below
  let api: Awaited<ReturnType<typeof widgetApi>> | undefined;
  try {
    api = await widgetApi();
  } catch {
    api = undefined;
  }
  if (api === null) {
    props.renderWidget(render({ kind: 'signedOut' }));
    return;
  }
  props.renderWidget(render(await loadWidgetData(api), data.id));
  let failure: 'signedOut' | 'error' | undefined = api ? undefined : 'error';
  if (api) {
    try {
      const { data: result, response } = await api.POST('/api/devices/{id}/commands', { params: { path: { id: data.deviceId } }, body: data.command });
      if (response.status === 401) {
        failure = 'signedOut';
      } else if (!response.ok || result?.status === 'confirmation_required') {
        // 403 (no right any more) or an action that needs an approval after all: the app handles those
        failure = 'error';
      }
    } catch {
      failure = 'error';
    }
  }
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

/**
 * Draws the widget again. The app passes what it already has (devices from the live connection, its layout and
 * colours), so a live change costs no extra request; without data the widget loads it itself.
 */
export async function updateQuickSwitchWidget(data?: WidgetData) {
  if (Platform.OS !== 'android') {
    return;
  }
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: async () => render(data ?? (await loadWidgetData())) });
}

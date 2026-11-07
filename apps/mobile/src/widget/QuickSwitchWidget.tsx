import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import type { ThemeColors } from '@smarthome/theme';

import type { WidgetData, WidgetItem } from './data';
import { iconSvg } from './icons';

/** Name of the widget in app.json (plugin react-native-android-widget) and in the task handler. */
export const WIDGET_NAME = 'QuickSwitch';

/** Click actions of the widget (handled in widgetTaskHandler). */
export const TOGGLE = 'TOGGLE';

const hex = (color: string) => color as ColorProp;

/**
 * "Schnellschalter": up to four devices from the layout's widget list, each with icon, name and state; a tap switches
 * it (or opens the app for the door and the like). Colours from the user's colour world; switched-on devices with
 * its gradient. `busyId`: the device just tapped, shown as switching until the new state is known.
 */
export function QuickSwitchWidget({ data, colors, busyId }: { data: WidgetData; colors: ThemeColors; busyId?: string }) {
  if (data.kind === 'signedOut') {
    return <Notice colors={colors} title="Smart Home" text="In der App anmelden, dann erscheinen hier deine Schnellschalter." />;
  }
  if (data.kind === 'error') {
    return <Notice colors={colors} title="Smart Home" text="Gerade nicht erreichbar. Tippen öffnet die App." />;
  }
  if (data.items.length === 0) {
    return <Notice colors={colors} title="Schnellschalter" text="In der App unter „Anpassen“ bis zu vier Geräte mit dem Stern wählen." />;
  }
  // two columns, one or two rows
  const rows = [data.items.slice(0, 2), data.items.slice(2, 4)].filter((r) => r.length > 0);
  return (
    <FlexWidget
      style={{ height: 'match_parent', width: 'match_parent', padding: 10, flexGap: 8, borderRadius: 28, backgroundColor: hex(colors.bg) }}
      accessibilityLabel="Smart Home Schnellschalter"
    >
      {rows.map((row, r) => (
        <FlexWidget key={r} style={{ flex: 1, width: 'match_parent', flexDirection: 'row', flexGap: 8 }}>
          {row.map((item) => (
            <Tile key={item.id} item={item} colors={colors} busy={item.id === busyId} />
          ))}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function Tile({ item, colors, busy }: { item: WidgetItem; colors: ThemeColors; busy: boolean }) {
  const on = item.on;
  const fg = on ? colors.accentText : colors.text;
  const muted = on ? colors.accentText : colors.muted;
  const status = busy ? 'schaltet …' : item.status;
  const click =
    item.tap.kind === 'toggle'
      ? { clickAction: TOGGLE, clickActionData: { id: item.id, deviceId: item.deviceId, command: item.tap.command } }
      : { clickAction: 'OPEN_APP' };
  return (
    <FlexWidget
      {...click}
      accessibilityLabel={`${item.name}, ${item.status}. ${item.tap.kind === 'toggle' ? `Tippen zum ${on ? 'Ausschalten' : 'Einschalten'}` : 'Tippen öffnet die App'}`}
      style={{
        flex: 1,
        height: 'match_parent',
        padding: 14,
        borderRadius: 22,
        justifyContent: 'space-between',
        // like the app's tiles: matte with a hairline until on, then lit with the gradient
        ...(on
          ? { backgroundGradient: { from: hex(colors.gradient[0]), to: hex(colors.gradient[1]), orientation: 'TL_BR' as const } }
          : { backgroundColor: hex(colors.surface), borderWidth: 1, borderColor: hex(`${colors.text}14`) }),
      }}
    >
      <FlexWidget
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          // frosted glass on the gradient
          ...(on ? { backgroundColor: hex('#ffffff4d'), borderWidth: 1, borderColor: hex('#ffffff66') } : { backgroundColor: hex(colors.surface2) }),
        }}
      >
        <SvgWidget svg={iconSvg(item.icon, on ? colors.accentText : colors.muted)} style={{ width: 20, height: 20 }} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent' }}>
        <TextWidget text={item.name} maxLines={2} truncate="END" style={{ fontSize: 14, fontWeight: '700', color: hex(fg) }} />
        <TextWidget text={status} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '500', color: hex(muted) }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Notice({ colors, title, text }: { colors: ThemeColors; title: string; text: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        padding: 18,
        borderRadius: 28,
        flexGap: 4,
        justifyContent: 'center',
        backgroundColor: hex(colors.surface),
      }}
    >
      <TextWidget text={title} style={{ fontSize: 17, fontWeight: '700', color: hex(colors.text) }} />
      <TextWidget text={text} maxLines={3} style={{ fontSize: 13, color: hex(colors.muted) }} />
    </FlexWidget>
  );
}

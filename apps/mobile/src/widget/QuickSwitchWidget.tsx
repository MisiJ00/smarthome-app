import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import type { ThemeColors } from '@smarthome/theme';

import type { HomescreenItem } from '@smarthome/core';

import { typeIcon } from '../components/devices/meta';
import type { WidgetData } from './data';
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

/** One tile; also used by the single device widget. `compact`: icon and state only (no room for the name). */
export function Tile({ item, colors, busy, compact = false }: { item: HomescreenItem; colors: ThemeColors; busy: boolean; compact?: boolean }) {
  const on = item.on;
  const fg = on ? colors.accentText : colors.text;
  const muted = on ? colors.accentText : colors.muted;
  const status = busy ? 'schaltet …' : item.status;
  // a tile without a right (placeholder) does nothing; the rest switches or opens the app
  const click =
    item.tap.kind === 'toggle'
      ? { clickAction: TOGGLE, clickActionData: { id: item.id, deviceId: item.deviceId, command: item.tap.command } }
      : item.tap.kind === 'open'
        ? { clickAction: 'OPEN_APP' }
        : {};
  return (
    <FlexWidget
      {...click}
      accessibilityLabel={`${item.placeholder ? 'Nicht verfügbar' : item.name}, ${item.status}. ${item.tap.kind === 'toggle' ? `Tippen zum ${on ? 'Ausschalten' : 'Einschalten'}` : item.tap.kind === 'open' ? 'Tippen öffnet die App' : ''}`}
      style={{
        flex: 1,
        height: 'match_parent',
        padding: 10,
        borderRadius: 22,
        justifyContent: 'space-between',
        // like the app's tiles: matte with a hairline until on, then lit with the gradient
        ...(on
          ? { backgroundGradient: { from: hex(colors.gradient[0]), to: hex(colors.gradient[1]), orientation: 'TL_BR' as const } }
          : { backgroundColor: hex(colors.surface), borderWidth: 1, borderColor: hex(`${colors.text}14`) }),
      }}
    >
      {/* icon and state side by side, the name below: fits a tile that is only about 90 dp high */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center', flexGap: compact ? 6 : 8 }}>
        <FlexWidget
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            // frosted glass on the gradient
            ...(on ? { backgroundColor: hex('#ffffff4d'), borderWidth: 1, borderColor: hex('#ffffff66') } : { backgroundColor: hex(colors.surface2) }),
          }}
        >
          <SvgWidget svg={iconSvg(typeIcon(item.deviceType, true), on ? colors.accentText : colors.muted)} style={{ width: 18, height: 18 }} />
        </FlexWidget>
        <TextWidget text={status} maxLines={compact ? 1 : 2} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: hex(muted) }} />
      </FlexWidget>
      {compact ? null : (
        <TextWidget text={item.placeholder ? 'Kein Zugriff' : item.name} maxLines={2} truncate="END" style={{ width: 'match_parent', fontSize: 14, fontWeight: '700', color: hex(fg) }} />
      )}
    </FlexWidget>
  );
}

export function Notice({ colors, title, text }: { colors: ThemeColors; title: string; text: string }) {
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

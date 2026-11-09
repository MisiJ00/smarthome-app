import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import type { ThemeColors } from '@smarthome/theme';

import { iconSvg } from './icons';
import { Notice, Tile } from './QuickSwitchWidget';
import type { SingleData } from './single';

/** Below this width (dp) there is no room for the name: icon and state only. */
export const COMPACT_BELOW_DP = 120;

/**
 * "Einzelgerät": one device as its own widget, in the style of the quick switch tiles. Narrow: icon and state; wider:
 * icon, state and name. `busy`: the device just tapped, shown as switching until the new state is known.
 */
export function SingleDeviceWidget({ data, colors, width, busy }: { data: SingleData; colors: ThemeColors; width: number; busy?: boolean }) {
  const compact = width < COMPACT_BELOW_DP;
  if (data.kind === 'signedOut') {
    return compact ? <CompactNotice colors={colors} label="Anmelden" /> : <Notice colors={colors} title="Smart Home" text="In der App anmelden." />;
  }
  if (data.kind === 'unset') {
    return compact ? <CompactNotice colors={colors} label="Gerät" /> : <Notice colors={colors} title="Gerät wählen" text="Tippen öffnet die App." />;
  }
  if (data.kind === 'error') {
    return compact ? <CompactNotice colors={colors} label="Offline" /> : <Notice colors={colors} title="Smart Home" text="Gerade nicht erreichbar." />;
  }
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'row' }} accessibilityLabel="Smart Home Einzelgerät">
      <Tile item={data.item} colors={colors} busy={busy === true} compact={compact} />
    </FlexWidget>
  );
}

/** The notice for a narrow instance: no room for sentences, so the icon and one short word. Tapping opens the app. */
function CompactNotice({ colors, label }: { colors: ThemeColors; label: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`Smart Home, ${label}. Tippen öffnet die App`}
      style={{ height: 'match_parent', width: 'match_parent', padding: 10, borderRadius: 22, flexGap: 6, backgroundColor: colors.surface as ColorProp }}
    >
      <FlexWidget style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 as ColorProp }}>
        <SvgWidget svg={iconSvg('device', colors.muted)} style={{ width: 18, height: 18 }} />
      </FlexWidget>
      <TextWidget text={label} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: colors.text as ColorProp }} />
    </FlexWidget>
  );
}

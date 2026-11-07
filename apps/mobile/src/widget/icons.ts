// Lucide icons as SVG text for the widget: widgets are drawn natively (RemoteViews), so the React icon components
// do not work there. The shapes come from the same Lucide version as in the app, via each icon's __iconData.
import { __iconData as blinds } from 'lucide-react-native/icons/blinds';
import { __iconData as cpu } from 'lucide-react-native/icons/cpu';
import { __iconData as heater } from 'lucide-react-native/icons/heater';
import { __iconData as lightbulb } from 'lucide-react-native/icons/lightbulb';
import { __iconData as lock } from 'lucide-react-native/icons/lock';
import { __iconData as lockOpen } from 'lucide-react-native/icons/lock-open';
import { __iconData as plug } from 'lucide-react-native/icons/plug';
import { __iconData as thermometer } from 'lucide-react-native/icons/thermometer';

import type { IconName } from '@smarthome/theme';

type IconData = typeof lightbulb;

/** The icons a widget tile can show (by the theme's names, see components/devices/meta.ts). */
const DATA: Partial<Record<IconName, IconData>> = {
  light: lightbulb,
  plug,
  switch: plug,
  lock,
  unlock: lockOpen,
  sensor: thermometer,
  climate: heater,
  cover: blinds,
  device: cpu,
};

const escape = (value: unknown) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** `<svg …>` of an icon in a colour (hex), 24×24 like Lucide. */
export function iconSvg(name: IconName, color: string, strokeWidth = 2): string {
  const data = DATA[name] ?? cpu;
  const children = data.node
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs as Record<string, unknown>)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${escape(value)}"`)
        .join(' ');
      return `<${tag} ${attributes}/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

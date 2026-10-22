import { useColorScheme } from 'react-native';

import { colors, type Colors } from '@smarthome/theme';

// Colours, spacing, radii and type sizes come from packages/theme, like the CSS variables of the web interface.
export { fontSize, fontWeight, radius, space, type Colors } from '@smarthome/theme';

/** The colours for the system's light or dark mode. */
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}

// Light, dark or like the system. The choice is remembered in this browser.
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'smarthome.theme';

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') {
    delete document.documentElement.dataset['theme'];
  } else {
    document.documentElement.dataset['theme'] = theme;
  }
  try {
    if (theme === 'system') {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, theme);
    }
  } catch {
    // Private mode: only for this visit
  }
}

export const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
export const themeLabel: Record<Theme, string> = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };

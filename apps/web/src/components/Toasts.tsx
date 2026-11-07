import { useCallback, type CSSProperties, type ReactNode } from 'react';
import { Toaster, toast as sonner } from 'sonner';

import { Icon } from './Icon';
import { useAppearance } from './theme';

export type ToastKind = 'info' | 'success' | 'error';

/** Sonner's colour variables, set to the design tokens (inline, so they win over Sonner's own light/dark values). */
const tokenColors = {
  '--normal-bg': 'var(--surface)',
  '--normal-border': 'var(--border)',
  '--normal-text': 'var(--text)',
  '--success-bg': 'var(--ok-soft)',
  '--success-border': 'color-mix(in srgb, var(--ok) 30%, transparent)',
  '--success-text': 'var(--ok)',
  '--info-bg': 'var(--accent-soft)',
  '--info-border': 'color-mix(in srgb, var(--accent) 30%, transparent)',
  '--info-text': 'var(--text)',
  '--error-bg': 'var(--danger-soft)',
  '--error-border': 'color-mix(in srgb, var(--danger) 30%, transparent)',
  '--error-text': 'var(--danger)',
  '--border-radius': 'var(--radius-md)',
} as CSSProperties;

/** Short notices at the bottom of the screen, e.g. "waiting for approval". Rendered by Sonner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { scheme } = useAppearance();
  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        theme={scheme === 'light' ? 'light' : 'dark'}
        richColors
        closeButton
        style={tokenColors}
        toastOptions={{ className: 'toast' }}
        icons={{
          info: <Icon name="info" size={18} />,
          success: <Icon name="check" size={18} />,
          error: <Icon name="warning" size={18} />,
        }}
        containerAriaLabel="Hinweise"
      />
    </>
  );
}

/** `toast(kind, text)` as before; a thin cover over Sonner, so callers need not know it. */
export function useToast() {
  return useCallback((kind: ToastKind, text: string) => {
    const options = { duration: kind === 'error' ? 7000 : 4000 };
    if (kind === 'success') {
      sonner.success(text, options);
    } else if (kind === 'error') {
      sonner.error(text, options);
    } else {
      sonner.info(text, options);
    }
  }, []);
}

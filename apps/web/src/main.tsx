import '@fontsource-variable/inter';
// The base styles first, so the styles of components (imported through App) come later and win at equal specificity
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { cssVariables } from '@smarthome/theme';

import { App } from './App';
import { initAppearance } from './components/theme';
import { registerServiceWorker } from './pwa';

// Design tokens as CSS variables (spacing, radii, type and the classic colours as fallback), before the first render
const tokens = document.createElement('style');
tokens.textContent = cssVariables();
document.head.prepend(tokens);

// The chosen colour world, mode and style on top (inline on <html>, so they win over the fallback)
initAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

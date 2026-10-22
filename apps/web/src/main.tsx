import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { cssVariables } from '@smarthome/theme';

import { App } from './App';
import { applyTheme, storedTheme } from './components/theme';
import './styles.css';

// Design tokens as CSS variables, before the first render
const tokens = document.createElement('style');
tokens.textContent = cssVariables();
document.head.prepend(tokens);

applyTheme(storedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

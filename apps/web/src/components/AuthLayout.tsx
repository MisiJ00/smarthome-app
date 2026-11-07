import type { ReactNode } from 'react';

import { Icon } from './Icon';

/** The frame of login, setup and account pages: a centred card on a soft gradient, the logo on top. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo logo-lg" aria-hidden="true">
            <Icon name="home" size={26} />
          </span>
          <span>Smart Home</span>
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function Errors({ texts }: { texts: string[] }) {
  if (texts.length === 0) {
    return null;
  }
  return (
    <div className="form-errors" role="alert">
      <Icon name="warning" size={18} />
      <div>
        {texts.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
    </div>
  );
}

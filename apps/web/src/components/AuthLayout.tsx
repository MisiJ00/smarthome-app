import type { ReactNode } from 'react';

/** The frame of login, setup and account pages. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
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
      {texts.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  );
}

// What a service asks for when it lets people sign in with this account (OpenID Connect scopes), in plain German.

const SCOPES: Record<string, { title: string; text: string }> = {
  openid: { title: 'Dich erkennen', text: 'Der Dienst weiß, dass du dieses Konto bist (eine anonyme Kennung, kein Passwort).' },
  profile: { title: 'Name und Benutzername', text: 'Dein Name und dein Benutzername.' },
  email: { title: 'E-Mail-Adresse', text: 'Deine E-Mail-Adresse.' },
  offline_access: { title: 'Angemeldet bleiben', text: 'Der Dienst darf sich später ohne dich neu anmelden, bis du es widerrufst.' },
};

export function scopeText(scope: string): { title: string; text: string } {
  return SCOPES[scope] ?? { title: scope, text: 'Eine weitere Berechtigung.' };
}

/** The scopes in a fixed, sensible order (identity first), unknown ones last. */
export function sortScopes(scopes: string[]): string[] {
  const order = Object.keys(SCOPES);
  return [...scopes].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
}

/** Only follow addresses over http(s): a redirect from the backend should never turn into a javascript: link. */
export function safeRedirect(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

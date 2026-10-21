import type { UiText } from './kratos';

// Kratos answers in English; the usual messages in German, everything else as Kratos says it.
// Ids: https://www.ory.sh/docs/kratos/concepts/ui-messages
const GERMAN: Record<number, string> = {
  4000006: 'E-Mail, Benutzername oder Passwort stimmt nicht.',
  4000008: 'Der Code stimmt nicht.',
  4010001: 'Die Anmeldung hat zu lange gedauert. Bitte noch einmal.',
  4060006: 'Der Code stimmt nicht oder wurde schon benutzt.',
  1060003: 'Code gesendet.',
  1050001: 'Gespeichert.',
};

export function german(message: UiText): string {
  return GERMAN[message.id] ?? message.text;
}

export function errorTexts(messages: UiText[]): string[] {
  return messages.filter((m) => m.type === 'error').map(german);
}

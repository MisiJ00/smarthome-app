// Test data may only ever go to the local development stack.
export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

export function isLocal(url) {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

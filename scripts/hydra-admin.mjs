// One request to Hydra's admin API from inside the Docker network (the admin port is not published on purpose).
// Only for the local development stack: the scripts that use this check their addresses with local-only.mjs.
import { execFileSync } from 'node:child_process';

const NETWORK = process.env.DOCKER_NETWORK ?? 'homeserver_default';

/** Returns { status, body } (body as text). */
export function hydraAdmin(method, path, body) {
  const args = ['run', '--rm', '--network', NETWORK, 'curlimages/curl:8.11.1', '-s', '-w', '\n%{http_code}', '-X', method];
  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  }
  args.push(`http://hydra:4445${path}`);
  const output = execFileSync('docker', args, { encoding: 'utf8' });
  const split = output.lastIndexOf('\n');
  return { status: Number(output.slice(split + 1)), body: output.slice(0, split) };
}

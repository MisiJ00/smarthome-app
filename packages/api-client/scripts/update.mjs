// Copies the OpenAPI description from the backend into this package.
// The backend writes it with: ./gradlew test --tests '*OpenApiExportTest' (in ../smarthome-backend).
// Alternatively set OPENAPI_URL to a running backend, e.g. http://localhost:8088/v3/api-docs
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../openapi.json', import.meta.url));
const url = process.env.OPENAPI_URL;

if (url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const spec = await response.json();
  await writeFile(target, JSON.stringify(spec, null, 2) + '\n');
  console.log(`Saved OpenAPI description from ${url}`);
} else {
  const source = fileURLToPath(
    new URL('../../../../smarthome-backend/build/openapi/openapi.json', import.meta.url),
  );
  await copyFile(source, target);
  console.log(`Copied OpenAPI description from ${source}`);
}

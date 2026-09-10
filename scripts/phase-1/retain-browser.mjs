/** Copy diagnostics independently of report parsing, including archive checkouts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
export async function retainBrowser(checkout, out, identity = {}) {
  await fs.mkdir(out, { recursive: true });
  const files = [], errors = [];
  for (const source of ['test-results', 'artifacts/browser-results.json']) {
    try { await fs.cp(path.join(checkout, source), path.join(out, source), { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') errors.push({ source, error: String(error) }); }
  }
  for (const file of await fs.readdir(out, { recursive: true })) {
    const p = path.join(out, file);
    if (!(await fs.stat(p)).isFile()) continue;
    const bytes = await fs.readFile(p);
    files.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ ...identity, files, errors }, null, 2) + '\n');
  if (errors.length) throw Error('Browser diagnostic collection incomplete; see manifest.json');
}

/** Exact, non-self-referential SHA-256 inventory for an explicitly selected evidence directory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { argument, sha256, sourceIdentity } from './results.mjs';

const directory = argument('directory'), manifestPath = argument('manifest');
if (!directory || !manifestPath) throw Error('Use --directory=DIR --manifest=FILE [--write]. Without --write, verify the complete path set and every byte.');
const base = path.resolve(directory), destination = path.resolve(manifestPath);
const relativeManifest = path.relative(base, destination).split(path.sep).join('/');
const excludes = relativeManifest && !relativeManifest.startsWith('../') && !path.isAbsolute(relativeManifest) ? [relativeManifest] : [];
const rows = [];
async function inventory(folder, relative = '') {
  for (const entry of (await fs.readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (excludes.includes(name)) continue;
    if (entry.isSymbolicLink()) throw Error(`Symbolic links are not evidence payloads: ${name}`);
    if (entry.isDirectory()) await inventory(path.join(folder, entry.name), name);
    else if (entry.isFile()) {
      const data = await fs.readFile(path.join(folder, entry.name));
      rows.push({ path: name, bytes: data.length, sha256: sha256(data) });
      if (rows.length > 100000) throw Error('Evidence inventory exceeds 100,000 files.');
    } else throw Error(`Unsupported filesystem entry: ${name}`);
  }
}
await inventory(base);
rows.sort((a, b) => a.path.localeCompare(b.path));
const contentSha256 = sha256(rows.map(row => `${row.sha256}  ${row.bytes}  ${row.path}\n`).join(''));
if (process.argv.includes('--write')) {
  const manifest = { kind: 'neptune-phase8-evidence-manifest', schemaVersion: 1, sourceIdentity: await sourceIdentity(),
    digestAlgorithm: 'SHA-256', digestEncoding: 'sha256 + two spaces + decimal bytes + two spaces + POSIX relative path + LF; sorted by path',
    excludedIdentityFiles: excludes, contentSha256, fileCount: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0), files: rows };
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`WROTE ${rows.length} files, content SHA-256 ${contentSha256}. Manifest is separately hashable and never includes its own hash.`);
} else {
  const expected = JSON.parse(await fs.readFile(destination, 'utf8'));
  if (expected.kind !== 'neptune-phase8-evidence-manifest' || expected.schemaVersion !== 1 || !Array.isArray(expected.files)) throw Error('Unsupported evidence manifest.');
  if (JSON.stringify(expected.excludedIdentityFiles) !== JSON.stringify(excludes)) throw Error('Manifest identity-file exclusions differ from the requested path.');
  if (expected.fileCount !== rows.length || JSON.stringify(expected.files) !== JSON.stringify(rows) || expected.contentSha256 !== contentSha256) {
    const before = new Map(expected.files.map(row => [row.path, row]));
    const after = new Map(rows.map(row => [row.path, row]));
    console.error(JSON.stringify({ missing: [...before.keys()].filter(name => !after.has(name)), added: [...after.keys()].filter(name => !before.has(name)),
      changed: rows.filter(row => before.has(row.path) && JSON.stringify(before.get(row.path)) !== JSON.stringify(row)).map(row => row.path) }, null, 2));
    throw Error('Evidence path set or bytes differ from the frozen manifest.');
  }
  console.log(`PASS ${rows.length} files, content SHA-256 ${contentSha256}; manifest SHA-256 ${sha256(await fs.readFile(destination))}.`);
}

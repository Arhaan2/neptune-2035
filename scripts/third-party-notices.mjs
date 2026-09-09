/** Preserve installed production-package notices. Some packages are build-only or tree-shaken. */
import fs from 'node:fs/promises';
import path from 'node:path';
const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const entries = [];
const missing = [];
for (const [dir, item] of Object.entries(lock.packages)) {
  if (!dir || item.dev || item.optional) continue;
  let pkg;
  try {
    pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  const names = (await fs.readdir(dir)).filter((n) =>
    /^(licen[sc]e|copying|notice)([.-]|$)/i.test(n),
  );
  const notices = [];
  for (const name of names.sort()) {
    const file = path.join(dir, name);
    if ((await fs.stat(file)).isFile())
      notices.push(`${name}\n${await fs.readFile(file, 'utf8')}`);
  }
  if (!notices.length) {
    try {
      notices.push(
        await fs.readFile(
          `docs/v2/licenses/${pkg.name.replaceAll('/', '__').replaceAll('@', '')}.txt`,
          'utf8',
        ),
      );
    } catch {
      /* reviewed upstream supplement may not be needed */
    }
  }
  if (!notices.length) {
    const readme = (await fs.readdir(dir)).find((n) =>
      /^readme(\.|$)/i.test(n),
    );
    if (readme) {
      const text = await fs.readFile(path.join(dir, readme), 'utf8');
      const position = text.search(/^#{1,4}[^\n]*(licen[sc]e|copyright)/im);
      if (position >= 0) notices.push(text.slice(position));
    }
  }
  if (!notices.length)
    missing.push({
      package: pkg.name,
      version: pkg.version,
      license: pkg.license ?? item.license,
    });
  entries.push(
    `${pkg.name} ${pkg.version}\nDeclared license: ${typeof pkg.license === 'string' ? pkg.license : (item.license ?? 'See supplied notice')}\n${notices.join('\n\n') || 'No separate notice shipped in this installed package; see upstream package license.'}`,
  );
}
await fs.writeFile(
  'public/THIRD-PARTY-NOTICES.txt',
  'NEPTUNE v2 — installed production-dependency license notices\n\nThis file preserves notices from the npm production dependency tree. Some listed packages are development-time tooling or eliminated from browser bundles. No endorsement is implied. Original project geometry, shaders and presentation: Arhaan Aggarwal.\n\n' +
    entries.sort().join('\n\n' + '='.repeat(78) + '\n\n') +
    '\n',
);
console.log(
  JSON.stringify(
    { packages: entries.length, missingNotices: missing },
    null,
    2,
  ),
);

# Release record

The current public prototype baseline was independently verified on 2026-09-10: source `06899f0668a05c6ba7f0a1bc0c96d33304eef580`, compiled Pages commit `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5`. The historical release below is retained for provenance. [Phase 2 equipment authority and release evidence](phase-2/RELEASE.md) records the bounded implementation, current acceptance state and preserved rollback. Full Phase 1 acceptance, performance/stability campaigns and physical validation remain deferred.

## Accepted application · 2026-09-08

- Source repository: https://github.com/Arhaan2/neptune-2035 (new, public; default branch `codex/neptune`).
- Published site address: https://arhaan2.github.io/neptune-2035/
- Source code commit: `127a2fade93112d58f8edd9f6fc6e9e02b12b57c`.
- Static deployment commit: `672805a984feadaab375061817c919fd6849b311` on `codex/pages`.
- Host: GitHub Pages, branch publishing (`legacy` build type), root path `/`, HTTPS, no custom domain. The deployment contains compiled assets, a `.nojekyll` marker and a `release.json` source manifest.
- GitHub deployment identifier: `6338812039`, environment `github-pages`.
- Pages build: `built`, completed 2026-09-08 22:56:57 UTC; no build error. The live `release.json` was retrieved and its source SHA matches the commit above.
- Hosted acceptance: all 15 browser cases passed in Chromium, Firefox and WebKit. All six required release-URL screenshots were inspected. See [QA](QA.md).
- Release checkpoint: `v0.1.0`. The checkpoint includes final documentation, evidence and the reusable video verifier; deployed application code remains the source commit above. The accepted application is frozen.
- Launch assets: verified `neptune-demo.mp4` and `neptune-screenshots.zip`, distributed as [release attachments](https://github.com/Arhaan2/neptune-2035/releases/tag/v0.1.0), outside Git history. The MP4 was captured from the live URL, decoded completely, played and sought in Chromium, and visually inspected at all six stages. It is silent, 30 seconds, 1280×720. Checksums and sanitized test data are in [evidence.json](evidence.json).

## Free hosting basis

GitHub documents that Pages is available in public repositories on GitHub Free: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages. This new repository is public and uses only that static hosting capability. No domain, paid API, purchase, plan change, or new billing commitment was made. A separately reserved Sites project remains private and unpublished because its connector did not expose pricing/plan metadata.

## Reproduction and rollback

Clone this repository and check out the source commit above. Run `npm ci`, `npm run lint`, `npm test` and `npm run build`. `dist/` is the static site. Vite uses relative asset paths, so it supports the GitHub project subpath.

Publishing copies `dist/` to the dedicated `codex/pages` branch and adds `.nojekyll` plus `release.json` identifying the source SHA. Push a normal new commit and wait for the GitHub Pages build. Check the served manifest and run:

```sh
NEPTUNE_BASE_URL=https://arhaan2.github.io/neptune-2035/ npm run test:browser
```

To roll back a later release, start from the latest `codex/pages` branch in a separate checkout, restore its tracked files from deployment commit `672805a984feadaab375061817c919fd6849b311`, and create/push a new commit. Do not reset shared history or force-push. Confirm the Pages build and served `release.json`, then rerun hosted acceptance. The source and compiled deployment histories are intentionally separate.

No unrelated repository, deployment, DNS record or global Git identity was changed. Local commits use the account's GitHub noreply address.

# Assets and tools

All facility geometry, ocean/sky shaders, scenario diagrams and screenshots were created for this project. No downloaded visual assets, external HDR maps, vendor model files or generated stock illustrations are required at runtime. Social preview and release screenshots are captures of the real app.

- React / React DOM, Three.js, React Three Fiber, Drei, Lucide and Shadcn/Base UI are installed through npm; their upstream package licenses apply. Retained starter UI components come from the official Sites scaffold. System Arial/Helvetica/sans-serif stacks require no distributed font files.
- Data/source attributions and the exact claims supported are in `src/domain/sources.ts` and `docs/MODEL.md`. NVIDIA and other referenced organizations do not endorse NEPTUNE.
- Video capture uses Playwright's bundled recorder. Temporary MP4 transcoding uses FFmpeg 4.4 from npm package `@ffmpeg-installer/darwin-arm64@4.1.5`; the encoder executable is not included in the app, repository or release assets. Its build includes GPL/nonfree components and is not redistributed by this project. Only the resulting original-project recording is distributed.

Original project concept and presentation: Arhaan Aggarwal. No model identity, build duration, autonomous-work percentage or unmeasured device performance is claimed.

## V2 dependency notices

`public/THIRD-PARTY-NOTICES.txt` preserves the installed production-dependency notices, including packages eliminated from the browser bundle. `scripts/third-party-notices.mjs` regenerates the file from the installed lockfile tree and reviewed supplements in `docs/v2/licenses`. Supplements name the exact versioned upstream source where available; input-otp, maath and MediaPipe use the upstream current notice retrieved on 2026-09-08 because their installed archives/tag roots omit a notice. stats-gl declares MIT in its installed README; its author attribution comes from package metadata, with no invented copyright year. The v2 reference/source registry is `src/twin/catalog/reference.ts`; all equipment envelopes remain explicitly assumed.

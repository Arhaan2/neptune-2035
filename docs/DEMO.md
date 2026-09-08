# Demo and recording

The **Play demo** control uses actual application scenario state, selection, shell visibility, exploded transforms and cameras. It can be stopped, restarted, or canceled by manual interaction or Escape. Completion/cancellation returns to the original scenario with a defined exterior view. Hidden tabs cancel the demo. Reduced-motion users see state changes without camera orbit or animated interpolation.

Storyboard: 0–5 s exterior; 5–10 s X-ray; 10–15 s cooling; 15–20 s six system groups exploded; 20–26 s generation III; 26–30 s closing question and actual current URL. Dates are labels, not forecasts. Captions show real model quantities.

Use **Presentation mode** for a clean 16:9 or 4:5 composition. The NEPTUNE identity and concept qualifier remain visible. The ordinary interface is also recordable with metrics and inspector text.

To reproduce the automated capture, start the app and run:

```sh
NEPTUNE_RECORD=1 npm run test:browser -- --project=chromium tests/browser/record.spec.ts
```

This writes a real 1280×720 WebM to `assets/demo/neptune-demo.webm`, the actual-page social preview to `public/social-preview.png`, plus cinematic and 800×1000 presentation screenshots. Use `NEPTUNE_BASE_URL` to capture the hosted release.

Manual recording: open the release URL; choose Presentation mode; set the window to 1280×720 or 800×1000; start your system screen recorder; select Play demo; keep the page foreground for 30 seconds; stop the recording. Do not crop out the concept qualifier. Press Escape or Stop demo to cancel and reset.

MP4 production uses a local FFmpeg encoder after checking the actual WebM recording. The system Xcode toolchain could not initialize for native encoding; it is not required to run or record NEPTUNE. The temporary FFmpeg executable is not redistributed. Exact transcoding and playback verification are recorded in QA.

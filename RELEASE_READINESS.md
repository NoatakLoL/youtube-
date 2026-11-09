# youtube+ Version 1.0 Release Readiness

**Status: HOLD — not a Version 1.0 release candidate yet.**

This branch contains a substantial compatibility-first refactor tranche, but it does not meet the complete P0/P1/P2 roadmap or the release verification requested. Keep PR #1 in draft and do not tag or publish Version 1.0 until the gates below are closed.

## Delivered in this branch

- Corrected FIFO acknowledgement in both DOM message queues.
- Corrected slash-delimited nested storage lookup and added a shared storage setter that preserves numeric zero values.
- Reworked locale fallback so English is requested once and the callback is settled once.
- Added a tab-activation generation guard.
- Added PlayerStateCoordinator for playback states, focus, PiP transitions, route/video cancellation signals, source changes on a reused video element, and listener disposal.
- Moved the coordinator ahead of the legacy player script so its route/video cancellation signal is available to early metadata work.
- Wired active legacy metadata fetches and the smart-speed timeout fetch wrapper to the coordinator's video signal, with requested-video identity checks after awaits.
- Added player-relative video centering and caption positioning controls.
- Added separate classic-script-compatible feature modules for bookmarks, frame capture, precision playback/pitch correction, audio EQ/gain/compression, in-player floating controls, and keyboard shortcuts.
- Added youtube+ Studio settings UI with search, collapsible Basic/Advanced groups, numeric validation, theme tokens, bookmarks view, and JSON import/export.
- Added Safari WebKit presentation-mode PiP fallback while retaining standard PiP behavior.
- Added regression tests for queues, nested storage, locale fallback, coordinator transitions/cancellation, audio presets, feature cleanup, bookmarks, capture filenames, playback pitch handling, and hotkey normalization.

New ytplus_* settings are opt-in. Existing settings keys and cross-context message shapes are retained.

## Verification evidence

The previous completed GitHub Actions run on the branch reported:

- **46 Jest suites passed**
- **256 Jest tests passed**
- Strict ESLint passed for the newly refactored modules.

A subsequent commit moved PlayerStateCoordinator before the legacy player script to ensure early metadata work receives its abort signal. Its CI run must also pass before treating the current head as verified.

The full-repository lint audit remains a substantial baseline issue: the last completed audit reported **3,698 errors and 488 warnings**. That audit is advisory in the workflow; it is not a clean lint result.

No manual browser validation has been completed in Chrome, Firefox, or Safari. Unit tests do not establish runtime compatibility.

## Release blockers

1. **Legacy lifecycle debt remains.** Existing feature scripts still contain route listeners, MutationObservers, timers, and DOM-node listeners that are not yet all owned by route-scoped lifecycle scopes. The new lifecycle manager covers only the new feature modules.
2. **The monolithic player script remains.** The 242 KB player injection module has not been fully decomposed into the proposed playback/layout/caption/audio domains. Global mutable state and implicit globals remain in the legacy code.
3. **Legacy settings dependencies remain.** menu/styles/sub-options.css still contains adjacent-sibling selectors. The Studio search covers the new Studio settings, not every legacy Satus setting.
4. **Feature coverage is incremental.** Existing legacy UI and Satus architecture remain for backward compatibility; Studio does not yet replace every legacy control or provide a complete searchable index of all existing settings.
5. **Thumbnail cancellation is not universal.** The active direct metadata requests and smart-speed fetch wrapper are signal-aware. No image-element fetch path was found in the inspected player script, but image/thumbnail URL requests across every legacy feature module have not been exhaustively migrated.
6. **Browser integration is not proven.** Standard PiP and Safari's WebKit presentation mode have unit-level coverage, but no browser automation/manual runs have verified focus changes, tab switching, PiP permissions, playback recovery, theater/fullscreen, Shorts, audio routing, or downloads on all three engines.
7. **Audio routing may be unavailable.** The equalizer fails closed if a MediaElementSource has already been created. The browser's audio graph, permission behavior, gain headroom, and latency still need real-device testing.
8. **Canvas capture may be restricted.** Native-resolution capture depends on the source being canvas-readable. DRM/tainted media can reject capture and is reported to the user.
9. **Migration/upgrade tests are missing.** A storage compatibility audit has not yet exercised real profiles upgraded from the current published extension.
10. **Full lint cleanup is unfinished.** Thousands of existing errors/warnings remain outside the new modules.

## PiP platform limitation

Standard browser PiP windows are controlled by the browser/operating system and do not allow an extension to insert arbitrary HTML controls into that separate PiP surface. This branch provides floating transport/docking controls inside the YouTube player and uses native PiP controls when the video enters PiP. It does not claim custom DOM controls inside the native PiP window.

## Release gate

Before changing PR #1 to Ready for Review or tagging Version 1.0:

- Complete route-scoped cleanup for legacy features and audit timers/observers/listeners.
- Finish modular extraction and eliminate implicit globals in migrated domains.
- Replace the adjacent-sibling dependency system or complete a compatibility-preserving metadata migration.
- Decide how Studio coexists with the full legacy settings catalogue and complete search coverage.
- Add upgrade/import tests against representative existing settings profiles.
- Run the full Jest suite and strict lint on all changed files.
- Add browser-level smoke tests for Chromium, Firefox, and Safari (including iOS/macOS Safari where supported).
- Verify focus/blur + autoplay + PiP races, video swaps, Shorts, theater/fullscreen, audio processing, and frame downloads.
- Review permissions and MV3/Safari injection behavior on supported builds.
- Only then set the manifest/package release version consistently, publish release notes, make PR #1 ready, and create the Version 1.0 tag.

No release tag has been created by this branch.

# youtube+ Version 1.0 Release Readiness

**Status: HOLD — this branch is not a Version 1.0 release candidate.**

PR #1 contains a verified incremental reliability and feature tranche, but the requested P0/P1/P2 roadmap is not complete and supported-browser runtime verification has not been performed. Keep PR #1 in draft. Do not merge or create a Version 1.0 tag until the release gates below are satisfied.

## Delivered in this branch

### Core reliability and cancellation

- Corrected FIFO acknowledgement/dispatch in both extension-world and page-world DOM message queues.
- Corrected slash-delimited nested storage reads. The extension storage setter now preserves explicit `false` and numeric zero values; only nullish/empty values are treated as removals.
- Reworked locale fallback to request English once and settle the callback once.
- Added a generation guard to asynchronous tab-activation handling.
- Added `PlayerStateCoordinator` for playback states, focus changes, standard PiP and Safari WebKit presentation mode, route/video AbortSignals, reused-video source changes, and explicit listener/observer disposal.
- Route cancellation begins on `yt-navigate-start` (as well as the existing SPA navigation events), so outstanding route/video work is invalidated earlier.
- The coordinator is loaded before the legacy player initializer. Inspected direct metadata requests and the smart-speed fetch wrapper use its video signal and verify requested-video identity after awaits.
- New feature modules are included in the actual ordered classic-script page-world injection list, and their web-accessible resource declarations are checked by a regression test.

### New feature layer and settings

- Added classic-script-compatible feature modules for timestamp bookmarks/notes, native-resolution canvas capture, precision playback/pitch preservation, optional Web Audio EQ/gain/compression, floating in-player transport/docking controls, and configurable keyboard shortcuts.
- Added a lifecycle scope/manager for the new feature modules, including disposal when the active video changes or the page is unloaded.
- Added player-relative Force Center and caption positioning controls.
- Added youtube+ Studio with searchable collapsible Basic/Advanced sections, theme tokens, numeric validation, keyboard mapping, bookmarks view, and JSON settings import/export.
- Kept the legacy Satus settings/runtime in place to avoid removing existing controls before the complete settings migration is ready.

### Additional safety fixes in the new tranche

- The audio graph now returns to a neutral, audible configuration when disabled rather than suspending the only `MediaElementSource` output path. Explicit zero gain is preserved as silence instead of being silently coerced to unity gain.
- The coordinator tracks user-initiated standard PiP enter/leave events on the active video element, in addition to WebKit presentation-mode changes.
- The platform limitation is explicit: standard browser PiP surfaces are browser/OS-owned and cannot host arbitrary extension DOM controls. Floating controls are shown in the YouTube player, not inside the separate native PiP window.

New `ytplus_*` settings are opt-in. Existing setting keys and cross-context message payload shapes remain compatibility requirements.

## Verification evidence

Latest successful GitHub Actions run for PR #1:

- **Commit:** `c77e5636de6a9ff5be305ca96f5b5c7a88b05f1a`
- **Run:** [GitHub Actions run #52](https://github.com/NoatakLoL/youtube-/actions/runs/42563728474)
- **Jest:** **46 suites passed; 261 tests passed**
- **Strict ESLint:** passed for the newly refactored modules and their listed tests.
- **Loader regression:** passed; verifies each newly injected module is declared as a web-accessible resource and appears in dependency order before the legacy player initializer where required.

The full-repository lint audit is **not clean**. It reported **3,698 errors and 489 warnings**. The workflow currently marks that audit `continue-on-error`, so the overall green workflow must not be represented as a full-repository lint pass.

Dependency installation also reported **10 npm audit findings (6 low, 1 moderate, 3 high)**. The run did not include a detailed audit report or remediation. Review the dependency tree and resolve or explicitly disposition those findings before release.

No manual or automated browser-integration suite has verified behavior on Chrome, Firefox, macOS Safari, or iOS Safari. Passing unit tests do not establish compatibility with those engines.

## Remaining release blockers

1. **Legacy lifecycle debt remains.** Existing legacy feature scripts still have route listeners, MutationObservers, timers, and DOM-node listeners that are not all owned by route-scoped lifecycle scopes. The new lifecycle manager covers only the new feature layer.
2. **The monolithic player script remains.** The large legacy player injection file has not been fully extracted into playback/layout/captions/audio domains. Legacy globals, implicit globals, and shared mutable state remain.
3. **Legacy settings CSS remains structurally coupled.** `menu/styles/sub-options.css` still contains adjacent-sibling and structure-dependent selectors. A complete declarative `data-ytplus-*` metadata migration has not been completed.
4. **Studio search is not comprehensive.** It indexes the new Studio settings, not the entire legacy Satus settings catalogue. The two interfaces still coexist.
5. **Cancellation coverage is incomplete.** The inspected metadata and smart-speed requests are signal-aware, but there has not been an exhaustive audit/migration of every legacy thumbnail, image, and asynchronous feature request.
6. **Browser integration is unverified.** Real-browser checks are still required for tab focus/blur, PiP and autopause races, video swaps, playlist auto-advance, Shorts, theater/fullscreen, audio routing, frame capture, downloads, permission behavior, and Safari injection.
7. **Audio ownership and lifecycle need runtime validation.** The feature fails closed when creating a second media source is rejected, but browser audio graph behavior, latency, gain headroom, source-node lifetime, and re-enable/disable cycles require real-device testing.
8. **Canvas capture has platform/content limits.** Capture depends on the video frame being canvas-readable. DRM/tainted sources may reject capture and must continue to fail gracefully.
9. **Upgrade compatibility is not proven.** Add migration/import/export tests using representative settings profiles from the currently published extension, including false/zero values and unknown legacy keys.
10. **Dependency risk remains open.** Review the 10 npm audit findings reported at install time and update pinned/transitive dependencies as appropriate without destabilizing the supported browser matrix.
11. **Full lint cleanup is unfinished.** Thousands of existing repository-level errors/warnings remain outside the strict linted tranche.
12. **Release version metadata is inconsistent.** `package.json` is `1.0.0`, while `manifest.json` currently reports version `4`. Decide and apply the store-compatible extension version separately from the semantic project release label, then document the mapping.

## Release gate

Before converting PR #1 to Ready for Review or tagging Version 1.0:

- Complete route-scoped cleanup and an event/timer/observer inventory for legacy features.
- Finish the required player-domain extraction and remove implicit globals from migrated code.
- Replace or compatibility-wrap adjacent-sibling setting dependencies and emit explicit dependency metadata.
- Decide how Studio will cover the entire settings catalogue; verify search, labels, keyboard accessibility, reduced motion, and light/dark contrast.
- Add representative legacy-profile upgrade, import, and export tests.
- Add browser-level smoke/automation coverage for Chromium, Firefox, and supported Safari environments.
- Verify focus/blur + autopause + PiP races, video reuse/navigation, Shorts, playlist transitions, theater/fullscreen, audio graph enable/disable, and frame downloads.
- Review MV3 permissions, web-accessible resources, content-script injection ordering, Safari MAIN-world injection, and Firefox API shims.
- Audit and disposition npm audit findings; establish strict lint policy for changed files and a separately tracked plan for the legacy baseline.
- Reconcile manifest/package versioning, prepare final release notes, and verify the exact tagged commit.
- Only after these gates pass, mark PR #1 Ready for Review and create the Version 1.0 tag.

**No Version 1.0 tag has been created.**

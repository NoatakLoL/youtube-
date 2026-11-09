# Architecture and incremental refactor

## Runtime constraints

The extension currently uses Manifest V3 with ordered classic-script injection into YouTube's page world. The popup/options UI is built on Satus. The page-world runtime and extension/content-script runtime communicate through the existing DOM message bridge. Until browser coverage proves otherwise, preserve these boundaries and the existing message payloads.

New modules should use strict-mode IIFEs with explicit dependency injection and optional CommonJS exports for Jest. This permits isolated unit tests without changing the manifest's execution model. Native ES-module migration should be a separate project after Chrome, Firefox, and Safari injection paths have dedicated integration tests.

## Player state coordinator

`js&css/web-accessible/state/player-state-coordinator.js` owns the cross-cutting playback/focus/PiP policy.

Tracked dimensions:
- Playback: `unstarted`, `buffering`, `playing`, `paused`, `ended`, `seeking`.
- Focus: visible/focused versus background/blurred.
- PiP: inactive/active, with in-flight transition labels.
- Route: URL identity and route epoch.

Invariants:
1. At most one coordinator instance is attached to `ImprovedTube`.
2. Repeated `start()` and `dispose()` calls are safe.
3. Route changes invalidate pending transition epochs and detach old video listeners.
4. A focus return may resume only media that was playing before blur.
5. PiP requests are guarded against duplicate in-flight entry and are reconciled after focus changes.
6. Existing settings keys and focus/blur message object shapes remain unchanged.

The coordinator intentionally delegates actual play/pause to the YouTube player API when available, with HTMLMediaElement fallback.

## Testing

Run:
- `npm test -- --runInBand`
- `npm run lint`

The coordinator tests cover media state transitions, focus pause/resume, and listener cleanup. Browser integration still needs to verify player replacement, playlist auto-advance, Shorts, PiP permissions, fullscreen, and tab focus behavior.

## Compatibility policy

- Do not rename or remove existing persisted setting keys.
- New settings must be opt-in unless they are strictly additive and behavior-neutral.
- Do not change cross-context message schemas without a versioned compatibility adapter.
- Keep page-world and extension-world APIs separate; do not assume `chrome.*` exists in the page world.
- Keep new features independently disableable and remove their listeners/observers when disabled or when their owning page lifecycle ends.

## Remaining migration work

The coordinator is a first seam, not a completed rewrite. The next safe slices are:
1. Add cancellation tokens to each metadata/speed feature at its request boundary.
2. Extract feature lifecycle scopes with explicit cleanup registration.
3. Move Satus setting definitions into smaller domain files without changing IDs or storage bindings.
4. Replace positional CSS dependencies with explicit dependency attributes emitted by the setting renderer.
5. Add browser automation for supported injection paths before changing script module format.
6. Introduce feature modules and UI redesign incrementally, preserving a working legacy settings view during migration.

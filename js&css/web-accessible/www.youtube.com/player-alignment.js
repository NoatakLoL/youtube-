/* ImprovedTube: player-relative alignment, resilient to SPA DOM replacement. */
(function () {
	'use strict';
	if (window.__itPlayerAlignmentInstalled) return;
	window.__itPlayerAlignmentInstalled = true;
	const style = document.createElement('style');
	style.textContent = ".html5-video-player.it-force-center-video .html5-video-container {\n\tdisplay: flex !important; align-items: center !important; justify-content: center !important; overflow: hidden !important;\n}\n.html5-video-player.it-force-center-video .html5-main-video.it-force-centered-video {\n\tleft: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important;\n\tmargin: auto !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important;\n}\n.html5-video-player.it-pin-captions .ytp-caption-window-container.it-pinned-captions {\n\tposition: absolute !important; left: var(--it-caption-x, 50%) !important; top: var(--it-caption-y, 82%) !important;\n\tright: auto !important; bottom: auto !important; width: max-content !important;\n\tmax-width: min(90%, 60rem) !important; transform: translate(-50%, -50%) !important;\n\tmargin: 0 !important; z-index: 42 !important; pointer-events: none !important;\n}\n.html5-video-player.it-pin-captions .ytp-caption-segment { white-space: normal !important; }\n@media (prefers-reduced-motion: reduce) {\n\t.html5-video-player.it-force-center-video *, .html5-video-player.it-pin-captions * { transition: none !important; }\n}";
	(document.head || document.documentElement).appendChild(style);
	let observer, resizeObserver, raf = 0, activePlayer = null, disposed = false;
	const keys = ['player_force_center', 'player_pin_subtitles', 'player_caption_x', 'player_caption_y'];
	const getSettings = () => window.ImprovedTube?.storage || {};
	const clamp = (v, fallback) => Number.isFinite(Number(v)) ? Math.min(95, Math.max(5, Number(v))) : fallback;
	function apply() {
		const settings = getSettings();
		const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
		if (!player) return;
		const video = player.querySelector('.html5-main-video');
		const captions = player.querySelector('.ytp-caption-window-container');
		if (activePlayer !== player) {
			activePlayer = player;
			resizeObserver?.disconnect();
			resizeObserver?.observe(player);
		}
		if (video) {
			player.classList.toggle('it-force-center-video', settings.player_force_center === true);
			video.classList.toggle('it-force-centered-video', settings.player_force_center === true);
		}
		if (captions) {
			const enabled = settings.player_pin_subtitles === true;
			player.classList.toggle('it-pin-captions', enabled);
			captions.classList.toggle('it-pinned-captions', enabled);
			if (enabled) {
				player.style.setProperty('--it-caption-x', clamp(settings.player_caption_x, 50) + '%');
				player.style.setProperty('--it-caption-y', clamp(settings.player_caption_y, 82) + '%');
			} else {
				player.style.removeProperty('--it-caption-x');
				player.style.removeProperty('--it-caption-y');
			}
		}
	}
	function schedule() { if (!disposed && !raf) raf = requestAnimationFrame(() => { raf = 0; apply(); }); }
	function onStorage(event) { const key = event.detail?.key; if (!key || keys.includes(key)) schedule(); }
	observer = new MutationObserver(schedule);
	observer.observe(document.documentElement, { childList: true, subtree: true });
	if (typeof ResizeObserver === 'function') resizeObserver = new ResizeObserver(schedule);
	document.addEventListener('yt-navigate-finish', schedule);
	document.addEventListener('fullscreenchange', schedule);
	document.addEventListener('it-player-alignment-settings-changed', onStorage);
	window.addEventListener('pagehide', function () {
		disposed = true; observer.disconnect(); resizeObserver?.disconnect();
		if (raf) cancelAnimationFrame(raf);
	}, { once: true });
	schedule();
})();
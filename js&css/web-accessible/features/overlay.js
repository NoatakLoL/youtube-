/* Floating transport controls stay in the YouTube player, not the OS PiP window. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.overlay = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	function init({ app, helpers, video }) {
		if (app.storage.ytplus_overlay_enabled !== true) return;
		video = video || helpers.getVideo(app);
		const player = helpers.getPlayer(app);
		if (!video || !player) return;
		const overlay = document.createElement('div');
		overlay.className = 'ytplus-floating-controls';
		overlay.setAttribute('aria-label', 'Floating video controls');
		const makeButton = (label, title, fn) => {
			const button = document.createElement('button');
			button.type = 'button'; button.textContent = label; button.title = title;
			button.addEventListener('click', fn); return button;
		};
		overlay.append(
			makeButton('−10', 'Back 10 seconds', () => { video.currentTime = Math.max(0, video.currentTime - 10); }),
			makeButton('Ⅱ', 'Play or pause', () => video.paused ? video.play().catch(() => {}) : video.pause()),
			makeButton('+10', 'Forward 10 seconds', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); })
		);
		const dock = makeButton('↘', 'Dock controls to another corner', () => {
			const positions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
			const current = positions.indexOf(overlay.dataset.dock || 'bottom-right');
			overlay.dataset.dock = positions[(current + 1) % positions.length];
		});
		overlay.appendChild(dock);
		player.appendChild(overlay);
		const getPiPElement = () => document['pictureInPictureElement'];
		const syncPiP = () => {
			overlay.hidden = getPiPElement() === video || video.webkitPresentationMode === 'picture-in-picture';
		};
		video.addEventListener('enterpictureinpicture', syncPiP);
		video.addEventListener('leavepictureinpicture', syncPiP);
		video.addEventListener('webkitpresentationmodechanged', syncPiP);
		syncPiP();
		app.YTPlus.actions = app.YTPlus.actions || {};
		const toggleOverlay = () => { overlay.hidden = !overlay.hidden; };
		app.YTPlus.actions.toggleOverlay = toggleOverlay;
		return () => {
			if (app.YTPlus.actions.toggleOverlay === toggleOverlay) delete app.YTPlus.actions.toggleOverlay;
			video.removeEventListener('enterpictureinpicture', syncPiP);
			video.removeEventListener('leavepictureinpicture', syncPiP);
			video.removeEventListener('webkitpresentationmodechanged', syncPiP);
			overlay.remove();
		};
	}
	return { init };
});

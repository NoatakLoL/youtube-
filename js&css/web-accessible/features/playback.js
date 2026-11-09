/* Fine-grained playback controls and pitch preservation. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.playback = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	function applyPitch(video, enabled) {
		if (!video) return false;
		const property = 'preservesPitch' in video ? 'preservesPitch'
			: 'mozPreservesPitch' in video ? 'mozPreservesPitch'
				: 'webkitPreservesPitch' in video ? 'webkitPreservesPitch' : null;
		if (!property) return false;
		video[property] = Boolean(enabled);
		return true;
	}
	function init({ app, helpers, video }) {
		video = video || helpers.getVideo(app);
		if (!video || app.storage.ytplus_precision_playback !== true) return;
		const player = helpers.getPlayer(app);
		const controls = player && (player.querySelector('.ytp-right-controls') || player);
		if (!controls) return;
		const step = () => Math.max(0.01, Math.min(1, Number(app.storage.ytplus_speed_step) || 0.05));
		const min = () => Math.max(0.1, Math.min(4, Number(app.storage.ytplus_speed_min) || 0.1));
		const max = () => Math.max(min(), Math.min(16, Number(app.storage.ytplus_speed_max) || 16));
		function setSpeed(value) {
			const next = Math.round(Math.min(max(), Math.max(min(), Number(value) || 1)) * 100) / 100;
			video.playbackRate = next;
			helpers.notify('Playback speed ' + next.toFixed(2) + '×');
			return next;
		}
		const group = document.createElement('span');
		group.className = 'ytplus-speed-controls';
		const down = document.createElement('button');
		down.type = 'button'; down.textContent = '−'; down.title = 'Decrease speed';
		const readout = document.createElement('span');
		readout.className = 'ytplus-speed-value'; readout.textContent = video.playbackRate.toFixed(2) + '×';
		const up = document.createElement('button');
		up.type = 'button'; up.textContent = '+'; up.title = 'Increase speed';
		const change = delta => {
			const value = setSpeed(video.playbackRate + delta);
			readout.textContent = value.toFixed(2) + '×';
		};
		down.addEventListener('click', () => change(-step()));
		up.addEventListener('click', () => change(step()));
		group.append(down, readout, up);
		controls.insertBefore(group, controls.firstChild);
		applyPitch(video, app.storage.ytplus_pitch_correction === true);
		app.YTPlus.actions = app.YTPlus.actions || {};
		const speedUp = () => change(step());
		const speedDown = () => change(-step());
		const resetSpeed = () => { video.playbackRate = 1; readout.textContent = '1.00×'; };
		app.YTPlus.actions.speedUp = speedUp;
		app.YTPlus.actions.speedDown = speedDown;
		app.YTPlus.actions.resetSpeed = resetSpeed;
		return () => {
			if (app.YTPlus.actions.speedUp === speedUp) delete app.YTPlus.actions.speedUp;
			if (app.YTPlus.actions.speedDown === speedDown) delete app.YTPlus.actions.speedDown;
			if (app.YTPlus.actions.resetSpeed === resetSpeed) delete app.YTPlus.actions.resetSpeed;
			group.remove();
		};
	}
	return { init, applyPitch };
});

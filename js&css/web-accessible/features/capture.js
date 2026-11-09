/* High-resolution video-frame capture using native media dimensions. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.capture = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	function safeFilename(value) {
		return String(value || 'youtube-video').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'youtube-video';
	}
	async function captureFrame(video, title, download = true) {
		if (!video || !video.videoWidth || !video.videoHeight) throw new Error('Video frame is not ready yet.');
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const context = canvas.getContext('2d', { alpha: false });
		if (!context) throw new Error('Canvas capture is unavailable.');
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode video frame.')), 'image/png'));
		if (!download) return blob;
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const timestamp = String(Math.floor(video.currentTime || 0)).padStart(5, '0');
		link.href = url;
		link.download = safeFilename(title) + '_' + timestamp + '.png';
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1500);
		return blob;
	}
	function init({ app, helpers }) {
		if (app.storage.ytplus_capture_enabled !== true) return;
		const video = helpers.getVideo(app);
		const player = helpers.getPlayer(app);
		if (!video || !player) return;
		const controls = player.querySelector('.ytp-right-controls') || player;
		const button = document.createElement('button');
		button.type = 'button'; button.className = 'ytplus-player-button';
		button.textContent = '▣'; button.title = 'Capture current frame (Alt+Shift+S)';
		button.setAttribute('aria-label', 'Capture video frame');
		controls.insertBefore(button, controls.firstChild);
		const run = async () => {
			try {
				await captureFrame(video, document.title.replace(/\s+-\s+YouTube$/, ''));
				helpers.notify('Frame captured at ' + helpers.formatTime(video.currentTime), 'success');
			} catch (error) {
				helpers.notify(error.message || 'Frame capture failed. The video may restrict canvas capture.', 'error');
			}
		};
		button.addEventListener('click', run);
		app.YTPlus.actions = app.YTPlus.actions || {};
		app.YTPlus.actions.capture = run;
		return () => button.remove();
	}
	return { init, captureFrame, safeFilename };
});

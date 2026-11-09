/* Opt-in Web Audio processing. A MediaElementSource is kept per video element to avoid a second-source failure. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.audio = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	const routing = new WeakMap();
	const PRESETS = {
		flat: [0, 0, 0, 0, 0], voice: [-3, 2, 4, 3, -2],
		bass: [5, 4, 1, 0, -1], treble: [-1, 0, 1, 4, 5], night: [2, 1, 0, -1, -2]
	};
	function setup(video) {
		if (routing.has(video)) return routing.get(video);
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) throw new Error('Web Audio is not available in this browser.');
		const context = new AudioContextClass();
		let source;
		try { source = context.createMediaElementSource(video); }
		catch (error) {
			context.close().catch(() => {});
			throw new Error('YouTube or another extension already owns this video audio route. The equalizer cannot safely take control.');
		}
		const filters = [60, 250, 1000, 4000, 12000].map((frequency, index) => {
			const node = context.createBiquadFilter();
			node.type = index === 0 ? 'lowshelf' : index === 4 ? 'highshelf' : 'peaking';
			node.frequency.value = frequency; node.Q.value = 0.8; return node;
		});
		const gain = context.createGain(); gain.gain.value = 1;
		let previous = source;
		filters.forEach(filter => { previous.connect(filter); previous = filter; });
		previous.connect(gain); gain.connect(context.destination);
		const graph = { context, source, filters, gain };
		routing.set(video, graph);
		return graph;
	}
	function apply(graph, settings) {
		const enabled = settings.ytplus_audio_enabled === true;
		const values = enabled ? (PRESETS[settings.ytplus_audio_preset] || PRESETS.flat) : PRESETS.flat;
		graph.filters.forEach((filter, index) => filter.gain.setTargetAtTime(values[index], graph.context.currentTime, 0.04));
		const gain = enabled ? Number(settings.ytplus_audio_gain) || 1 : 1;
		graph.gain.gain.setTargetAtTime(Math.max(0, Math.min(3, gain)), graph.context.currentTime, 0.05);
	}
	function attach({ app, helpers, video }) {
		let graph;
		try { graph = setup(video); apply(graph, app.storage); }
		catch (error) { helpers.notify(error.message, 'error'); return undefined; }
		const resume = () => graph.context.resume().catch(() => {});
		video.addEventListener('play', resume);
		video.addEventListener('playing', resume);
		if (app.storage.ytplus_audio_enabled === true) resume();
		return () => {
			video.removeEventListener('play', resume);
			video.removeEventListener('playing', resume);
			apply(graph, { ytplus_audio_enabled: false });
			/* Keep the one-to-one MediaElementSource mapping for a reused YouTube video node. */
			graph.context.suspend().catch(() => {});
		};
	}
	function init(context) {
		const app = context.app;
		app.YTPlus.actions = app.YTPlus.actions || {};
		app.YTPlus.actions.toggleAudio = () => toggle(app);
		if (app.storage.ytplus_audio_enabled !== true) return;
		return attach(Object.assign({}, context, { video: context.video || context.helpers.getVideo(app) }));
	}
	function onSettingsChange(context) {
		const video = context.video || context.helpers.getVideo(context.app);
		if (!video) return;
		const graph = routing.get(video);
		if (graph) {
			apply(graph, context.app.storage);
			if (context.app.storage.ytplus_audio_enabled === true) graph.context.resume().catch(() => {});
			else graph.context.suspend().catch(() => {});
			return;
		}
		if (context.app.storage.ytplus_audio_enabled === true) return attach(Object.assign({}, context, { video }));
	}
	function toggle(app) {
		const enabled = app.storage.ytplus_audio_enabled !== true;
		const values = { ytplus_audio_enabled: enabled, ytplus_audio_gain: enabled ? 1.5 : 1, ytplus_audio_preset: enabled ? 'voice' : 'flat' };
		Object.assign(app.storage, values);
		Object.entries(values).forEach(([key, value]) => app.messages && app.messages.send({ action: 'set', key, value }));
	}
	return { init, onSettingsChange, presets: Object.keys(PRESETS), apply, toggle };
});

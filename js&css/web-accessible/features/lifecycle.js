/* Feature lifecycle manager. Features are initialized once per video and disposed on replacement/navigation. */
(function () {
	'use strict';
	const app = window.ImprovedTube;
	if (!app || app.YTPlusLifecycle) return;
	const helpers = app.YTPlus;
	let ready = false, activeVideo = null, activeSignal = null, activeRouteSignal = null;
	let activeScope = null, activeCleanups = {}, disposed = false, context = null;
	function safeCleanup(name, cleanup) {
		if (typeof cleanup !== 'function') return;
		try { cleanup(); } catch (error) { console.warn('[youtube+] cleanup failed: ' + name, error); }
	}
	function cleanupModules(preserveAudio = false) {
		Object.entries(activeCleanups).forEach(([name, cleanup]) => {
			if (preserveAudio && name === 'audio') return;
			safeCleanup(name, cleanup);
			delete activeCleanups[name];
		});
		if (activeScope) activeScope.dispose();
		activeScope = null;
	}
	function buildContext(video, signal, routeSignal) {
		return { app, helpers, video, signal, routeSignal, scope: activeScope };
	}
	function initializeModules(skipAudio = false) {
		if (!ready || disposed || !activeVideo || !context) return;
		Object.entries(app.featureModules || {}).forEach(([name, module]) => {
			if (!module || typeof module.init !== 'function' || (skipAudio && name === 'audio')) return;
			if (activeCleanups[name]) return;
			try {
				const cleanup = module.init(context);
				if (typeof cleanup === 'function') activeCleanups[name] = cleanup;
			} catch (error) { console.warn('[youtube+] feature initialization failed: ' + name, error); }
		});
	}
	function destroyAll() {
		cleanupModules(false);
		activeVideo = null; activeSignal = null; activeRouteSignal = null; context = null;
	}
	function initAll(video, signal, routeSignal) {
		if (!ready || disposed || !helpers) return;
		video = video || helpers.getVideo(app);
		if (!video) return;
		if (video === activeVideo && signal === activeSignal) return;
		destroyAll();
		activeVideo = video;
		activeSignal = signal || (app.stateCoordinator && app.stateCoordinator.videoSignal);
		activeRouteSignal = routeSignal || (app.stateCoordinator && app.stateCoordinator.routeSignal);
		activeScope = helpers.createScope(activeSignal);
		context = buildContext(video, activeSignal, activeRouteSignal);
		initializeModules(false);
	}
	function onRouteWillChange() { destroyAll(); }
	function onVideoChange(event) {
		const detail = event.detail || {};
		initAll(detail.video || helpers.getVideo(app), detail.signal, detail.routeSignal);
	}
	function onSettingsChange() {
		if (!activeVideo || !context) return;
		const audio = app.featureModules && app.featureModules.audio;
		const audioCleanup = activeCleanups.audio;
		cleanupModules(true);
		activeScope = helpers.createScope(activeSignal);
		context = buildContext(activeVideo, activeSignal, activeRouteSignal);
		initializeModules(true);
		if (audio && typeof audio.onSettingsChange === 'function') {
			try {
				const cleanup = audio.onSettingsChange(context);
				if (typeof cleanup === 'function') activeCleanups.audio = cleanup;
				else if (audioCleanup) activeCleanups.audio = audioCleanup;
			} catch (error) { console.warn('[youtube+] audio settings update failed', error); }
		} else if (audioCleanup) activeCleanups.audio = audioCleanup;
	}
	function onReady() {
		ready = true;
		initAll(helpers.getVideo(app), app.stateCoordinator && app.stateCoordinator.videoSignal, app.stateCoordinator && app.stateCoordinator.routeSignal);
	}
	function dispose() {
		if (disposed) return;
		disposed = true; destroyAll();
		document.removeEventListener('ytplus:routewillchange', onRouteWillChange);
		document.removeEventListener('ytplus:videochange', onVideoChange);
		document.removeEventListener('ytplus:settingschange', onSettingsChange);
		document.removeEventListener('init_completed', onReady);
		window.removeEventListener('pagehide', dispose);
	}
	document.addEventListener('ytplus:routewillchange', onRouteWillChange);
	document.addEventListener('ytplus:videochange', onVideoChange);
	document.addEventListener('ytplus:settingschange', onSettingsChange);
	document.addEventListener('init_completed', onReady);
	window.addEventListener('pagehide', dispose, { once: true });
	app.YTPlusLifecycle = { initAll, destroyAll, dispose, reconfigure: onSettingsChange };
})();

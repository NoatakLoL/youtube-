/* youtube+ shared feature utilities. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) {
		root.ImprovedTube.YTPlus = Object.assign(root.ImprovedTube.YTPlus || {}, api);
		root.ImprovedTube.featureModules = root.ImprovedTube.featureModules || {};
	}
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	function createScope(signal) {
		const cleanups = [];
		let disposed = false;
		function addCleanup(fn) {
			if (typeof fn !== 'function') return fn;
			if (disposed) {
				try { fn(); } catch (_) { }
			} else {
				cleanups.push(fn);
			}
			return fn;
		}
		function listen(target, type, listener, options) {
			if (!target || !target.addEventListener || disposed || (signal && signal.aborted)) return function () {};
			target.addEventListener(type, listener, options);
			const remove = () => target.removeEventListener(type, listener, options);
			addCleanup(remove);
			return remove;
		}
		function observe(observer, target, options) {
			if (!observer || !target || disposed) return observer;
			observer.observe(target, options);
			addCleanup(() => observer.disconnect());
			return observer;
		}
		function dispose() {
			if (disposed) return;
			disposed = true;
			while (cleanups.length) {
				try { cleanups.pop()(); } catch (error) { console.warn('[youtube+] cleanup failed', error); }
			}
			if (signal) signal.removeEventListener('abort', dispose);
		}
		if (signal) {
			if (signal.aborted) dispose();
			else signal.addEventListener('abort', dispose, { once: true });
		}
		return { listen, observe, addCleanup, dispose, get disposed() { return disposed; }, get signal() { return signal; } };
	}
	function videoId(locationObject) {
		const loc = locationObject || (typeof window !== 'undefined' ? window.location : null);
		return loc && loc.pathname && loc.pathname.startsWith('/shorts/')
			? loc.pathname.split('/')[2]
			: new URLSearchParams(loc ? loc.search : '').get('v');
	}
	function formatTime(seconds) {
		const total = Math.max(0, Math.floor(Number(seconds) || 0));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		return h ? [h, String(m).padStart(2, '0'), String(s).padStart(2, '0')].join(':')
			: [m, String(s).padStart(2, '0')].join(':');
	}
	function escapeMarkdown(value) {
		const escapable = new Set(['\\', String.fromCharCode(96), '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '-', '.', '!', '|', '>']);
		return Array.from(String(value === undefined || value === null ? '' : value), character => {
			return escapable.has(character) ? '\\' + character : character;
		}).join('').replace(/\r?\n/g, ' ');
	}
	function notify(message, kind = 'info') {
		if (typeof document === 'undefined') return;
		let toast = document.querySelector('.ytplus-toast');
		if (!toast) {
			toast = document.createElement('div');
			toast.className = 'ytplus-toast';
			toast.setAttribute('role', 'status');
			document.documentElement.appendChild(toast);
		}
		toast.dataset.kind = kind;
		toast.textContent = message;
		toast.classList.add('is-visible');
		clearTimeout(toast._hideTimer);
		toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
	}
	function save(app, key, value) {
		if (!app || !app.storage) return;
		if (value === undefined || value === null || value === false || value === '') delete app.storage[key];
		else app.storage[key] = value;
		if (app.messages && app.messages.send) app.messages.send({ action: 'set', key, value });
	}
	function getVideo(app) {
		return (app && app.elements && app.elements.video) || document.querySelector('#movie_player video.html5-main-video') || document.querySelector('video.html5-main-video');
	}
	function getPlayer(app) {
		return (app && app.elements && app.elements.player) || document.querySelector('#movie_player');
	}
	return { createScope, videoId, formatTime, escapeMarkdown, notify, save, getVideo, getPlayer };
});

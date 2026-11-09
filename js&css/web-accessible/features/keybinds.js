/* Customizable keyboard shortcut dispatch. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.keybinds = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	const DEFAULTS = {
		bookmark: 'alt+shift+b', capture: 'alt+shift+s', speedUp: 'alt+arrowup',
		speedDown: 'alt+arrowdown', togglePiP: 'alt+shift+p',
		toggleAudio: 'alt+shift+v', toggleOverlay: 'alt+shift+o'
	};
	function normalize(event) {
		const keys = [];
		if (event.ctrlKey) keys.push('ctrl');
		if (event.altKey) keys.push('alt');
		if (event.shiftKey) keys.push('shift');
		if (event.metaKey) keys.push('meta');
		const key = event.key.toLowerCase();
		if (!['control', 'alt', 'shift', 'meta'].includes(key)) keys.push(key === ' ' ? 'space' : key);
		return keys.join('+');
	}
	function init({ app, helpers, scope }) {
		const bindings = Object.assign({}, DEFAULTS, app.storage.ytplus_hotkeys || {});
		const actions = app.YTPlus.actions || {};
		const handlers = {
			bookmark: actions.bookmark, capture: actions.capture, speedUp: actions.speedUp,
			speedDown: actions.speedDown, toggleAudio: actions.toggleAudio, toggleOverlay: actions.toggleOverlay,
			togglePiP: () => {
				if (!app.stateCoordinator) return;
				if (app.stateCoordinator.pip === 'active') app.stateCoordinator.exitPiP();
				else app.stateCoordinator.requestPiP();
			}
		};
		scope.listen(document, 'keydown', event => {
			if (event.defaultPrevented || event.repeat) return;
			const target = event.target;
			if (target && (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)) return;
			const chord = normalize(event);
			for (const [action, binding] of Object.entries(bindings)) {
				if (binding && String(binding).toLowerCase() === chord && typeof handlers[action] === 'function') {
					event.preventDefault(); event.stopPropagation();
					try { handlers[action](); } catch (error) { helpers.notify('Shortcut failed: ' + error.message, 'error'); }
					return;
				}
			}
		}, true);
	}
	return { init, defaults: DEFAULTS, normalize };
});

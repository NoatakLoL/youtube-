/* youtube+ Studio: modern overlay around the legacy settings runtime. */
(function () {
	'use strict';
	if (window.extension && window.extension.studio) return;
	const api = window.browser || window.chrome;
	if (!api || !api.storage || !api.storage.local) return;
	const DEFAULT_HOTKEYS = {
		bookmark: 'Alt+Shift+B', capture: 'Alt+Shift+S', speedUp: 'Alt+ArrowUp',
		speedDown: 'Alt+ArrowDown', togglePiP: 'Alt+Shift+P',
		toggleAudio: 'Alt+Shift+V', toggleOverlay: 'Alt+Shift+O'
	};
	const state = { settings: {}, bookmarks: [], activeTab: 'settings', mounted: false, root: null };
	function getAll() { return api.storage.local.get(null); }
	function setMany(values) { return api.storage.local.set(values); }
	function save(key, value) {
		state.settings[key] = value;
		return setMany({ [key]: value }).then(() => {
			document.dispatchEvent(new CustomEvent('ytplus:settingschange', { detail: { key, value } }));
			if (['player_force_center', 'player_pin_subtitles', 'player_caption_x', 'player_caption_y'].includes(key)) {
				document.dispatchEvent(new CustomEvent('it-player-alignment-settings-changed', { detail: { key, value } }));
			}
		});
	}
	function el(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}
	function section(title, description, target) {
		const details = el('details', 'ytplus-accordion');
		details.open = false;
		const summary = el('summary', 'ytplus-accordion-title');
		const copy = el('span', 'ytplus-section-copy');
		copy.append(el('strong', '', title), el('small', '', description));
		summary.append(copy, el('span', 'ytplus-chevron', '⌄'));
		details.appendChild(summary);
		const content = el('div', 'ytplus-section-content');
		details.appendChild(content);
		target.appendChild(details);
		return content;
	}
	function row(label, description, key, control) {
		const wrapper = el('div', 'ytplus-setting-row');
		wrapper.dataset.search = (label + ' ' + description + ' ' + key).toLowerCase();
		const copy = el('div', 'ytplus-setting-copy');
		copy.append(el('strong', '', label), el('small', '', description));
		wrapper.append(copy, control);
		return wrapper;
	}
	function toggle(label, description, key, container) {
		const input = el('input', 'ytplus-toggle-input');
		input.type = 'checkbox';
		input.checked = state.settings[key] === true;
		const visual = el('span', 'ytplus-toggle-track');
		const labelNode = el('label', 'ytplus-toggle');
		labelNode.append(input, visual);
		input.addEventListener('change', () => save(key, input.checked));
		container.appendChild(row(label, description, key, labelNode));
	}
	function numberField(label, description, key, min, max, step, fallback, container) {
		const input = el('input', 'ytplus-number');
		input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step);
		input.value = String(state.settings[key] === undefined ? fallback : state.settings[key]);
		input.addEventListener('change', () => {
			const value = Number(input.value);
			if (!Number.isFinite(value) || value < min || value > max) {
				input.setCustomValidity('Enter a value from ' + min + ' to ' + max + '.');
				input.reportValidity(); input.value = String(fallback); return;
			}
			input.setCustomValidity('');
			save(key, value);
		});
		container.appendChild(row(label, description, key, input));
	}
	function selectField(label, description, key, options, fallback, container) {
		const select = el('select', 'ytplus-select');
		options.forEach(([value, name]) => {
			const option = el('option', '', name); option.value = value; select.appendChild(option);
		});
		select.value = state.settings[key] || fallback;
		select.addEventListener('change', () => save(key, select.value));
		container.appendChild(row(label, description, key, select));
	}
	function exportFile(name, data, type) {
		const blob = new Blob([data], { type });
		const url = URL.createObjectURL(blob);
		const link = el('a'); link.href = url; link.download = name; link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1500);
	}
	async function exportConfiguration() {
		const all = await getAll();
		delete all.password;
		exportFile('youtube-plus-settings-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(all, null, 2), 'application/json');
	}
	async function importConfiguration(file) {
		const parsed = JSON.parse(await file.text());
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The backup must contain a JSON settings object.');
		delete parsed.password;
		await setMany(parsed);
		state.settings = Object.assign({}, state.settings, parsed);
		renderSettings();
	}
	function chord(event) {
		const pieces = [];
		if (event.ctrlKey) pieces.push('Ctrl');
		if (event.altKey) pieces.push('Alt');
		if (event.shiftKey) pieces.push('Shift');
		if (event.metaKey) pieces.push('Meta');
		const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
		if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) pieces.push(key);
		return pieces.join('+');
	}
	function hotkeyField(action, label, container, hotkeys) {
		const button = el('button', 'ytplus-keybind', hotkeys[action] || DEFAULT_HOTKEYS[action]);
		button.type = 'button';
		button.title = 'Focus then press a key combination';
		button.addEventListener('keydown', event => {
			event.preventDefault(); event.stopPropagation();
			if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
			hotkeys[action] = chord(event);
			button.textContent = hotkeys[action];
			save('ytplus_hotkeys', hotkeys);
			button.blur();
		});
		container.appendChild(row(label, 'Click, then press the replacement shortcut.', 'keyboard shortcut ' + action, button));
	}
	function renderSettings() {
		const panel = state.root.querySelector('.ytplus-settings-content');
		panel.replaceChildren();
		const search = state.root.querySelector('.ytplus-search').value.toLowerCase().trim();
		const basic = el('div', 'ytplus-group-label', 'BASIC');
		panel.appendChild(basic);
		const playback = section('Playback', 'Fine control over playback behavior', panel);
		toggle('Precision playback', 'Enable custom playback speed increments and controls.', 'ytplus_precision_playback', playback);
		toggle('Pitch correction', 'Preserve pitch where the browser exposes media pitch correction.', 'ytplus_pitch_correction', playback);
		numberField('Speed increment', 'Adjustment amount per shortcut or control click.', 'ytplus_speed_step', 0.01, 1, 0.01, 0.05, playback);
		numberField('Minimum speed', 'Lowest permitted custom playback speed.', 'ytplus_speed_min', 0.1, 4, 0.05, 0.1, playback);
		numberField('Maximum speed', 'Highest permitted custom playback speed.', 'ytplus_speed_max', 0.1, 16, 0.05, 16, playback);

		const layout = section('Layout & captions', 'Video alignment and pinned subtitle placement', panel);
		toggle('Force Center', 'Center the video element inside the YouTube player.', 'player_force_center', layout);
		toggle('Pin captions', 'Anchor caption windows to a stable position in the player.', 'player_pin_subtitles', layout);
		numberField('Caption horizontal position (%)', 'Position relative to the player width.', 'player_caption_x', 5, 95, 1, 50, layout);
		numberField('Caption vertical position (%)', 'Position relative to the player height.', 'player_caption_y', 5, 95, 1, 82, layout);
		toggle('Floating player controls', 'Show transport and docking controls over the video.', 'ytplus_overlay_enabled', layout);

		const bookmarks = section('Bookmarks & notes', 'Save timestamp markers and export your notes', panel);
		toggle('Enable timestamp bookmarks', 'Add a bookmark button to the YouTube player.', 'ytplus_bookmarks_enabled', bookmarks);
		const capture = section('Frame capture', 'Save native-resolution video frames', panel);
		toggle('Enable frame capture', 'Add a one-click PNG frame capture button.', 'ytplus_capture_enabled', capture);

		const advanced = el('div', 'ytplus-group-label', 'ADVANCED');
		panel.appendChild(advanced);
		const audio = section('Audio & equalizer', 'Optional Web Audio processing; may be unavailable when another player pipeline owns the media element.', panel);
		toggle('Enable equalizer', 'Opt in to Web Audio processing for this video.', 'ytplus_audio_enabled', audio);
		selectField('Audio preset', 'Choose the equalizer curve.', 'ytplus_audio_preset', [
			['flat', 'Flat'], ['voice', 'Voice clarity'], ['bass', 'Bass boost'],
			['treble', 'Treble boost'], ['night', 'Night mode compression']
		], 'flat', audio);
		numberField('Master gain (×)', 'Linear gain multiplier. 3.0 is 300%; high levels may distort.', 'ytplus_audio_gain', 0, 3, 0.05, 1, audio);

		const keys = section('Keyboard shortcuts', 'Customize hotkeys for player actions', panel);
		const hotkeys = Object.assign({}, DEFAULT_HOTKEYS, state.settings.ytplus_hotkeys || {});
		hotkeyField('bookmark', 'Drop bookmark', keys, hotkeys);
		hotkeyField('capture', 'Capture frame', keys, hotkeys);
		hotkeyField('speedUp', 'Increase speed', keys, hotkeys);
		hotkeyField('speedDown', 'Decrease speed', keys, hotkeys);
		hotkeyField('togglePiP', 'Toggle Picture-in-Picture', keys, hotkeys);
		hotkeyField('toggleAudio', 'Toggle audio processing', keys, hotkeys);
		hotkeyField('toggleOverlay', 'Toggle floating controls', keys, hotkeys);

		const config = section('Configuration backup', 'Export or import the extension configuration as JSON.', panel);
		const exportButton = el('button', 'ytplus-primary-button', 'Export settings');
		exportButton.type = 'button'; exportButton.addEventListener('click', () => exportConfiguration().catch(error => notify(error.message, 'error')));
		const importLabel = el('label', 'ytplus-file-button', 'Import JSON backup');
		const importInput = el('input'); importInput.type = 'file'; importInput.accept = 'application/json,.json';
		importInput.addEventListener('change', async () => {
			if (!importInput.files || !importInput.files[0]) return;
			try {
				await importConfiguration(importInput.files[0]);
				notify('Settings imported. Reload YouTube tabs to apply all legacy settings.', 'success');
			} catch (error) {
				notify(error.message || 'Could not import settings.', 'error');
			}
			importInput.value = '';
		});
		importLabel.appendChild(importInput);
		config.append(exportButton, importLabel);

		panel.querySelectorAll('.ytplus-setting-row').forEach(setting => {
			setting.hidden = Boolean(search && !setting.dataset.search.includes(search));
		});
		panel.querySelectorAll('.ytplus-accordion').forEach(group => {
			const visible = Array.from(group.querySelectorAll('.ytplus-setting-row')).some(item => !item.hidden);
			group.hidden = Boolean(search && !visible);
			if (search && visible) group.open = true;
		});
		const basicGroups = [playback, layout, bookmarks, capture].map(content => content.parentElement);
		const advancedGroups = [audio, keys, config].map(content => content.parentElement);
		basic.hidden = Boolean(search && !basicGroups.some(group => !group.hidden));
		advanced.hidden = Boolean(search && !advancedGroups.some(group => !group.hidden));
	}
	function notify(message, kind) {
		const note = el('div', 'ytplus-inline-status', message);
		note.dataset.kind = kind || 'info';
		state.root.querySelector('.ytplus-status').replaceChildren(note);
	}
	function renderBookmarks() {
		const panel = state.root.querySelector('.ytplus-bookmarks-content');
		panel.replaceChildren();
		const search = state.root.querySelector('.ytplus-bookmark-search').value.trim().toLowerCase();
		const bookmarks = Array.isArray(state.settings.ytplus_bookmarks) ? state.settings.ytplus_bookmarks : [];
		const visible = bookmarks.filter(item => !search || String(item.note || '').toLowerCase().includes(search) || String(item.title || '').toLowerCase().includes(search));
		if (!visible.length) panel.appendChild(el('p', 'ytplus-empty', 'No matching bookmarks have been saved yet.'));
		visible.slice().reverse().forEach(item => {
			const card = el('article', 'ytplus-bookmark-card');
			const go = el('button', 'ytplus-bookmark-open', (item.title || 'YouTube video') + ' · ' + (item.timeLabel || '0:00'));
			go.type = 'button';
			go.addEventListener('click', () => {
				const targetUrl = item.url || ('https://www.youtube.com/watch?v=' + item.videoId);
				const currentUrl = new URL(location.href);
				const currentId = currentUrl.pathname.startsWith('/shorts/') ? currentUrl.pathname.split('/')[2] : currentUrl.searchParams.get('v');
				if (item.videoId && item.videoId === currentId) {
					const video = document.querySelector('#movie_player video');
					if (video) video.currentTime = Number(item.seconds) || 0;
				} else {
					const target = new URL(targetUrl);
					target.searchParams.set('t', String(Math.floor(Number(item.seconds) || 0)));
					location.href = target.toString();
				}
			});
			card.append(go, el('p', '', item.note || 'No note'));
			panel.appendChild(card);
		});
	}
	function mountUi() {
		if (state.mounted) return;
		state.mounted = true;
		const root = el('section', 'ytplus-studio');
		root.id = 'ytplus-studio';
		root.innerHTML = '<header class="ytplus-studio-header"><div class="ytplus-brand"><span class="ytplus-brand-mark">+</span><div><strong>youtube+ Studio</strong><small>Playback tools and preferences</small></div></div><span class="ytplus-version">STUDIO</span></header><nav class="ytplus-tabs" aria-label="Studio pages"><button type="button" data-tab="settings" aria-selected="true">Settings</button><button type="button" data-tab="bookmarks" aria-selected="false">Bookmarks</button></nav><div class="ytplus-status" aria-live="polite"></div><div class="ytplus-settings-view"><label class="ytplus-search-wrap"><span>⌕</span><input class="ytplus-search" type="search" placeholder="Search settings" autocomplete="off" aria-label="Search settings"></label><div class="ytplus-settings-content"></div></div><div class="ytplus-bookmarks-view" hidden><label class="ytplus-search-wrap"><span>⌕</span><input class="ytplus-bookmark-search" type="search" placeholder="Search saved notes" aria-label="Search bookmarks"></label><div class="ytplus-bookmarks-content"></div><footer><button type="button" data-export-bookmarks="json">Export JSON</button><button type="button" data-export-bookmarks="markdown">Export Markdown</button></footer></div>';
		state.root = root;
		const loading = document.getElementById('loading');
		if (loading) loading.remove();
		document.body.prepend(root);
		root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
			state.activeTab = button.dataset.tab;
			root.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
			root.querySelector('.ytplus-settings-view').hidden = state.activeTab !== 'settings';
			root.querySelector('.ytplus-bookmarks-view').hidden = state.activeTab !== 'bookmarks';
			if (state.activeTab === 'bookmarks') renderBookmarks();
		}));
		root.querySelector('.ytplus-search').addEventListener('input', renderSettings);
		root.querySelector('.ytplus-bookmark-search').addEventListener('input', renderBookmarks);
		root.querySelectorAll('[data-export-bookmarks]').forEach(button => button.addEventListener('click', () => {
			const values = Array.isArray(state.settings.ytplus_bookmarks) ? state.settings.ytplus_bookmarks : [];
			if (button.dataset.exportBookmarks === 'json') exportFile('youtube-bookmarks.json', JSON.stringify(values, null, 2), 'application/json');
			else {
				const markdown = values.map(item => '- [' + (item.timeLabel || '0:00') + '](' + (item.url || '') + ') — ' + String(item.note || '').replace(/[\r\n]+/g, ' ')).join('\n');
				exportFile('youtube-bookmarks.md', '# YouTube bookmarks\n\n' + markdown, 'text/markdown');
			}
		}));
		renderSettings(); renderBookmarks();
	}
	async function initialize(force = false) {
		if (state.mounted) return;
		try {
			state.settings = await getAll();
		} catch (error) {
			console.warn('[youtube+] settings storage unavailable', error);
			state.settings = {};
		}
		/* Keep the existing extension password gate authoritative. */
		if (!force && state.settings.require_password === true && state.settings.password) return;
		mountUi();
	}
	window.extension = window.extension || {};
	window.extension.studio = {
		mount: () => initialize(true),
		initialize: () => initialize(false)
	};
	api.storage.onChanged && api.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local') return;
		Object.keys(changes).forEach(key => { state.settings[key] = changes[key].newValue; });
		if (state.root) { renderSettings(); renderBookmarks(); }
	});
})();

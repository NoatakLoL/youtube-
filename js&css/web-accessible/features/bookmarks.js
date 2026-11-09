/* Timestamp bookmarks and notes. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root && root.ImprovedTube) root.ImprovedTube.featureModules.bookmarks = api;
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	function toMarkdown(bookmarks) {
		return (bookmarks || []).map(item => '- [' + (item.timeLabel || '0:00') + '](' + (item.url || '') + ') — ' + String(item.note || '').replace(/[\r\n]+/g, ' ').trim()).join('\n');
	}
	function currentId() {
		const url = new URL(location.href);
		return url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : url.searchParams.get('v');
	}
	function init({ app, helpers }) {
		if (app.storage.ytplus_bookmarks_enabled !== true) return;
		const video = helpers.getVideo(app);
		const player = helpers.getPlayer(app);
		if (!video || !player) return;
		const id = currentId();
		if (!id) return;
		const controls = player.querySelector('.ytp-right-controls') || player;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'ytplus-player-button';
		button.textContent = '☆';
		button.title = 'Save timestamp bookmark (Alt+Shift+B)';
		button.setAttribute('aria-label', 'Save timestamp bookmark');
		controls.insertBefore(button, controls.firstChild);
		const panel = document.createElement('section');
		panel.className = 'ytplus-bookmark-panel';
		panel.hidden = true;
		panel.setAttribute('aria-label', 'Video bookmarks');
		panel.innerHTML = '<header><strong>Bookmarks</strong><button type="button" data-close aria-label="Close bookmarks">×</button></header><form><label>Note <input name="note" maxlength="240" placeholder="What should you remember?" autocomplete="off"></label><button type="submit">Save at current time</button></form><input class="ytplus-bookmark-search" type="search" placeholder="Search notes" aria-label="Search bookmarks"><div class="ytplus-bookmark-list" aria-live="polite"></div><footer><button type="button" data-export="json">Export JSON</button><button type="button" data-export="markdown">Export Markdown</button></footer>';
		player.appendChild(panel);
		let bookmarks = Array.isArray(app.storage.ytplus_bookmarks) ? app.storage.ytplus_bookmarks.slice() : [];
		const current = () => bookmarks.filter(item => item.videoId === id);
		function persist() { helpers.save(app, 'ytplus_bookmarks', bookmarks); }
		function download(name, content, type) {
			const blob = new Blob([content], { type });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url; link.download = name; link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
		function render() {
			const list = panel.querySelector('.ytplus-bookmark-list');
			const term = panel.querySelector('.ytplus-bookmark-search').value.trim().toLowerCase();
			list.replaceChildren();
			current().filter(item => !term || String(item.note).toLowerCase().includes(term) || item.timeLabel.includes(term)).forEach(item => {
				const row = document.createElement('div'); row.className = 'ytplus-bookmark-item';
				const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'ytplus-bookmark-jump'; jump.textContent = item.timeLabel + ' · ' + item.note;
				jump.addEventListener('click', () => { video.currentTime = item.seconds; video.play().catch(() => {}); });
				const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = 'Delete bookmark';
				remove.addEventListener('click', () => { bookmarks = bookmarks.filter(entry => entry.id !== item.id); persist(); render(); });
				row.append(jump, remove); list.appendChild(row);
			});
			if (!list.children.length) {
				const empty = document.createElement('p'); empty.className = 'ytplus-empty'; empty.textContent = 'No bookmarks for this video yet.'; list.appendChild(empty);
			}
		}
		function add(note) {
			const seconds = Math.max(0, Number(video.currentTime) || 0);
			const item = {
				id: id + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 7),
				videoId: id, title: document.title.replace(/\s+-\s+YouTube$/, ''), url: location.href,
				seconds: Math.round(seconds * 100) / 100, timeLabel: helpers.formatTime(seconds),
				note: String(note || '').trim(), createdAt: new Date().toISOString()
			};
			bookmarks.push(item); persist(); render(); helpers.notify('Bookmark saved at ' + item.timeLabel, 'success'); return item;
		}
		button.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) panel.querySelector('input[name="note"]').focus(); });
		panel.querySelector('[data-close]').addEventListener('click', () => { panel.hidden = true; });
		panel.querySelector('form').addEventListener('submit', event => {
			event.preventDefault();
			const input = panel.querySelector('input[name="note"]');
			add(input.value); input.value = '';
		});
		panel.querySelector('.ytplus-bookmark-search').addEventListener('input', render);
		panel.querySelectorAll('[data-export]').forEach(control => control.addEventListener('click', () => {
			const items = current();
			if (control.dataset.export === 'json') download('youtube-bookmarks-' + id + '.json', JSON.stringify(items, null, 2), 'application/json');
			else download('youtube-bookmarks-' + id + '.md', '# Bookmarks — ' + document.title + '\n\n' + toMarkdown(items), 'text/markdown');
		}));
		render();
		app.YTPlus.actions = app.YTPlus.actions || {};
		app.YTPlus.actions.bookmark = () => {
			panel.hidden = false;
			panel.querySelector('input[name="note"]').focus();
		};
		return () => { panel.remove(); button.remove(); };
	}
	return { init, toMarkdown };
});

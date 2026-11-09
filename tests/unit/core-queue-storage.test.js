const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeCustomEvent {
	constructor(type, init = {}) {
		this.type = type;
		this.detail = init.detail;
	}
}

function makeDocument() {
	const listeners = new Map();
	const elements = [];
	const documentElement = {
		appendChild: element => { elements.push(element); return element; },
		setAttribute: jest.fn(),
		hasAttribute: jest.fn(() => false)
	};
	return {
		documentElement,
		elements,
		createElement: tagName => ({ tagName, style: {}, textContent: '', id: '', appendChild: jest.fn() }),
		querySelector: jest.fn(() => null),
		addEventListener(type, listener) {
			if (!listeners.has(type)) listeners.set(type, []);
			listeners.get(type).push(listener);
		},
		removeEventListener(type, listener) {
			listeners.set(type, (listeners.get(type) || []).filter(item => item !== listener));
		},
		dispatchEvent(event) {
			(listeners.get(event.type) || []).slice().forEach(listener => listener(event));
			return true;
		}
	};
}

function loadScript(relativePath, extra = {}) {
	const document = makeDocument();
	const sandbox = {
		document,
		CustomEvent: FakeCustomEvent,
		console,
		localStorage: {},
		setTimeout,
		clearTimeout,
		...extra
	};
	const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
	vm.runInNewContext(source, sandbox, { filename: relativePath });
	return { sandbox, document };
}

test('extension message queue advances FIFO after acknowledgement', () => {
	const chrome = {
		storage: {
			onChanged: { addListener: jest.fn() },
			local: { get: jest.fn(), set: jest.fn() }
		}
	};
	const { sandbox, document } = loadScript('../../js&css/extension/core.js', { chrome });
	const extension = sandbox.extension;
	extension.messages.create();
	extension.messages.listener();

	extension.messages.send({ id: 1 });
	extension.messages.send({ id: 2 });
	expect(JSON.parse(extension.messages.element.textContent)).toEqual({ id: 1 });
	expect(extension.messages.queue).toHaveLength(2);

	document.dispatchEvent(new FakeCustomEvent('it-message-from-extension--readed'));

	expect(extension.messages.queue).toHaveLength(1);
	expect(JSON.parse(extension.messages.element.textContent)).toEqual({ id: 2 });
});

test('page-world message queue advances FIFO after acknowledgement', () => {
	const { sandbox, document } = loadScript('../../js&css/web-accessible/core.js');
	const improvedTube = sandbox.ImprovedTube;

	improvedTube.messages.send({ id: 1 });
	improvedTube.messages.send({ id: 2 });
	expect(JSON.parse(improvedTube.messages.element.textContent)).toEqual({ id: 1 });
	expect(improvedTube.messages.queue).toHaveLength(2);

	document.dispatchEvent(new FakeCustomEvent('it-message-from-youtube--readed'));

	expect(improvedTube.messages.queue).toHaveLength(1);
	expect(JSON.parse(improvedTube.messages.element.textContent)).toEqual({ id: 2 });
});

test('extension storage.get traverses slash-delimited nested paths', () => {
	const { sandbox } = loadScript('../../js&css/extension/core.js', {
		chrome: { storage: { onChanged: { addListener: jest.fn() }, local: { get: jest.fn(), set: jest.fn() } } }
	});
	const extension = sandbox.extension;
	extension.storage.data = { preferences: { captions: { x: 48, y: 83 } }, unchanged: 'keep' };

	expect(extension.storage.get('preferences/captions/x')).toBe(48);
	expect(extension.storage.get('/preferences//captions/y/')).toBe(83);
	expect(extension.storage.get('preferences/missing/value')).toBeUndefined();
	expect(extension.storage.get('unchanged')).toBe('keep');
});

test('storage-change notifications update only the changed top-level key and retain the message contract', () => {
	let onChanged;
	const chrome = {
		storage: {
			onChanged: { addListener: listener => { onChanged = listener; } },
			local: { get: jest.fn(), set: jest.fn() }
		}
	};
	const { sandbox, document } = loadScript('../../js&css/extension/core.js', { chrome });
	const extension = sandbox.extension;
	extension.storage.data = { keep: 'unchanged', player_caption_x: 40 };
	extension.messages.create();
	extension.messages.listener();
	extension.storage.listener();

	onChanged({ player_caption_x: { newValue: 62 } });

	expect(extension.storage.data).toEqual({ keep: 'unchanged', player_caption_x: 62 });
	const message = JSON.parse(extension.messages.element.textContent);
	expect(message).toEqual({
		action: 'storage-changed',
		camelizedKey: 'playerCaptionX',
		key: 'player_caption_x',
		value: 62
	});
	expect(document.documentElement.setAttribute).toHaveBeenCalledWith('it-player-caption-x', 62);
});

test('extension storage.set persists zero and false values and removes nullish values', () => {
	const set = jest.fn();
	const remove = jest.fn();
	const chrome = {
		storage: {
			onChanged: { addListener: jest.fn() },
			local: { get: jest.fn(), set, remove }
		}
	};
	const { sandbox } = loadScript('../../js&css/extension/core.js', { chrome });
	const storage = sandbox.extension.storage;

	storage.set('ytplus_audio_gain', 0);
	expect(set).toHaveBeenCalledWith({ ytplus_audio_gain: 0 });
	expect(remove).not.toHaveBeenCalled();

	storage.set('ytplus_enabled', false);
	expect(set).toHaveBeenCalledWith({ ytplus_enabled: false });
	expect(remove).not.toHaveBeenCalled();

	storage.set('ytplus_optional', null);
	expect(remove).toHaveBeenCalledWith(['ytplus_optional']);
});

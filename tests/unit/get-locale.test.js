const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGetLocale(fetchImpl) {
	const source = fs.readFileSync(path.join(__dirname, '../../background.js'), 'utf8');
	const start = source.indexOf('function getLocale');
	const end = source.indexOf('/*--------------------------------------------------------------\n# CONTEXT MENU', start);
	if (start < 0 || end < 0) throw new Error('Could not locate getLocale implementation');
	const declaration = source.slice(start, end);
	return vm.runInNewContext(declaration + '\ngetLocale;', { fetch: fetchImpl, Promise });
}

test('getLocale requests English once after a missing requested language', async () => {
	const fetch = jest.fn()
		.mockResolvedValueOnce({ ok: false })
		.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hello: { message: 'Hello' } }) });
	const getLocale = loadGetLocale(fetch);
	const callback = jest.fn();

	getLocale('fr-FR', callback);
	await new Promise(resolve => setTimeout(resolve, 0));

	expect(fetch).toHaveBeenCalledTimes(2);
	expect(fetch.mock.calls.map(call => call[0])).toEqual([
		'_locales/fr/messages.json',
		'_locales/en/messages.json'
	]);
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith({ hello: { message: 'Hello' } });
});

test('getLocale settles once with an empty object if both requested and English locales fail', async () => {
	const fetch = jest.fn()
		.mockRejectedValueOnce(new Error('offline'))
		.mockRejectedValueOnce(new Error('offline'));
	const getLocale = loadGetLocale(fetch);
	const callback = jest.fn();

	getLocale('de-DE', callback);
	await new Promise(resolve => setTimeout(resolve, 0));

	expect(fetch).toHaveBeenCalledTimes(2);
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith({});
});

test('getLocale does not retry English when English itself fails', async () => {
	const fetch = jest.fn().mockResolvedValueOnce({ ok: false });
	const getLocale = loadGetLocale(fetch);
	const callback = jest.fn();

	getLocale('en-US', callback);
	await new Promise(resolve => setTimeout(resolve, 0));

	expect(fetch).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith({});
});

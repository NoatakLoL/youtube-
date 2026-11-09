const runtime = require('../../js&css/web-accessible/features/runtime');
test('scope removes registered listeners when aborted', () => {
	const target = new EventTarget();
	const controller = new AbortController();
	const handler = jest.fn();
	const scope = runtime.createScope(controller.signal);
	scope.listen(target, 'sample', handler);
	target.dispatchEvent(new Event('sample'));
	expect(handler).toHaveBeenCalledTimes(1);
	controller.abort();
	target.dispatchEvent(new Event('sample'));
	expect(handler).toHaveBeenCalledTimes(1);
});
test('scope cleanup is idempotent', () => {
	const scope = runtime.createScope();
	expect(() => { scope.dispose(); scope.dispose(); }).not.toThrow();
});

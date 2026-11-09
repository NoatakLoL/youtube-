const keybinds = require('../../js&css/web-accessible/features/keybinds');
test('keyboard chord normalization includes modifiers in deterministic order', () => {
	expect(keybinds.normalize({ ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, key: 'ArrowUp' })).toBe('ctrl+alt+arrowup');
});
test('keyboard chord normalization handles space', () => {
	expect(keybinds.normalize({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: ' ' })).toBe('space');
});

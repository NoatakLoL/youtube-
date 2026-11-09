const capture = require('../../js&css/web-accessible/features/capture');
test('frame capture filename is safe for common video title characters', () => {
	expect(capture.safeFilename('A/B:C? D')).toBe('A_B_C_ D');
});
test('frame capture filename has a non-empty fallback', () => {
	expect(capture.safeFilename('///')).toBe('youtube-video');
});

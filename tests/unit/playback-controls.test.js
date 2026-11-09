const playback = require('../../js&css/web-accessible/features/playback');
test('pitch preservation selects the standard media property where supported', () => {
	const video = { preservesPitch: false };
	expect(playback.applyPitch(video, true)).toBe(true);
	expect(video.preservesPitch).toBe(true);
});
test('pitch preservation reports unsupported browser implementations', () => {
	expect(playback.applyPitch({}, true)).toBe(false);
});

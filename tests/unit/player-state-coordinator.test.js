const PlayerStateCoordinator = require('../../js&css/web-accessible/state/player-state-coordinator');
function videoFixture() {
	const listeners = {};
	return { paused: false, ended: false, pause: jest.fn(function () { this.paused = true; }), play: jest.fn(function () { this.paused = false; return Promise.resolve(); }),
		addEventListener: jest.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
		removeEventListener: jest.fn((type, fn) => { listeners[type] = (listeners[type] || []).filter(x => x !== fn); }),
		emit(type) { (listeners[type] || []).forEach(fn => fn()); } };
}
function documentFixture() {
	const listeners = {};
	return { visibilityState: 'visible', hasFocus: () => true, pictureInPictureEnabled: true, pictureInPictureElement: null, documentElement: {},
		addEventListener: jest.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
		removeEventListener: jest.fn((type, fn) => { listeners[type] = (listeners[type] || []).filter(x => x !== fn); }),
		exitPictureInPicture: jest.fn(async function () { this.pictureInPictureElement = null; }), listeners };
}
test('tracks explicit media lifecycle states', () => {
	const video = videoFixture(), document = documentFixture();
	const c = new PlayerStateCoordinator({ document, getVideo: () => video, getSettings: () => ({}) }).start();
	expect(c.playback).toBe('playing'); video.emit('waiting'); expect(c.playback).toBe('buffering');
	video.emit('seeking'); expect(c.playback).toBe('seeking'); video.emit('ended'); expect(c.playback).toBe('ended'); c.dispose();
});
test('autopause resumes only playback that was active before blur', async () => {
	const video = videoFixture(), document = documentFixture();
	const c = new PlayerStateCoordinator({ document, getVideo: () => video, getSettings: () => ({ player_autopause_when_switching_tabs: true }) }).start();
	await c.setFocus(false); expect(video.pause).toHaveBeenCalledTimes(1);
	await c.setFocus(true); expect(video.play).toHaveBeenCalledTimes(1); c.dispose();
});
test('start and dispose are idempotent and listeners are cleaned up', () => {
	const video = videoFixture(), document = documentFixture();
	const c = new PlayerStateCoordinator({ document, getVideo: () => video, getSettings: () => ({}) });
	c.start(); c.start(); expect(document.addEventListener).toHaveBeenCalledTimes(5);
	c.dispose(); c.dispose(); expect(document.removeEventListener).toHaveBeenCalledTimes(5);
	expect(video.removeEventListener).toHaveBeenCalledTimes(10);
});

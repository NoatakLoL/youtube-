const PlayerStateCoordinator = require('../../js&css/web-accessible/state/player-state-coordinator');
function videoFixture() {
	const listeners = {};
	return { paused: false, ended: false, src: 'blob:video-initial', currentSrc: 'blob:video-initial', pause: jest.fn(function () { this.paused = true; }), play: jest.fn(function () { this.paused = false; return Promise.resolve(); }),
		addEventListener: jest.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
		removeEventListener: jest.fn((type, fn) => { listeners[type] = (listeners[type] || []).filter(x => x !== fn); }),
		emit(type) { (listeners[type] || []).forEach(fn => fn()); } };
}
function documentFixture(window) {
	const listeners = {};
	return { visibilityState: 'visible', hasFocus: () => true, pictureInPictureEnabled: true, pictureInPictureElement: null, documentElement: {},
		addEventListener: jest.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
		removeEventListener: jest.fn((type, fn) => { listeners[type] = (listeners[type] || []).filter(x => x !== fn); }),
		dispatchEvent: jest.fn(event => (listeners[event.type] || []).forEach(fn => fn(event))),
		exitPictureInPicture: jest.fn(async function () { this.pictureInPictureElement = null; }), listeners, defaultView: window };
}
function setup() {
	let video = videoFixture();
	const window = { location: { href: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }, CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }, console: { warn: jest.fn() } };
	const document = documentFixture(window);
	const coordinator = new PlayerStateCoordinator({ document, window, getVideo: () => video, getSettings: () => ({ player_autopause_when_switching_tabs: true }) });
	coordinator.start();
	return { coordinator, document, window, get video() { return video; }, swap(next) { video = next; } };
}
test('tracks media lifecycle states', () => {
	const { coordinator, video } = setup();
	expect(coordinator.playback).toBe('playing'); video.emit('waiting'); expect(coordinator.playback).toBe('buffering');
	video.emit('seeking'); expect(coordinator.playback).toBe('seeking'); video.emit('ended'); expect(coordinator.playback).toBe('ended'); coordinator.dispose();
});
test('autopause resumes only playback that was active before blur', async () => {
	const { coordinator, video } = setup(); await coordinator.setFocus(false); expect(video.pause).toHaveBeenCalledTimes(1);
	await coordinator.setFocus(true); expect(video.play).toHaveBeenCalledTimes(1); coordinator.dispose();
});
test('route changes abort both old route and old video requests', () => {
	const fixture = setup(), routeSignal = fixture.coordinator.routeSignal, videoSignal = fixture.coordinator.videoSignal;
	fixture.window.location.href = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';
	fixture.document.dispatchEvent({ type: 'yt-navigate-finish' });
	expect(routeSignal.aborted).toBe(true); expect(videoSignal.aborted).toBe(true);
	expect(fixture.coordinator.routeSignal.aborted).toBe(false); fixture.coordinator.dispose();
});
test('video replacement aborts the previous video signal', () => {
	const fixture = setup(), oldSignal = fixture.coordinator.videoSignal, next = videoFixture(); fixture.swap(next);
	fixture.coordinator._attachCurrentVideo('test'); expect(oldSignal.aborted).toBe(true); expect(fixture.coordinator.video).toBe(next); fixture.coordinator.dispose();
});
test('initialization and disposal are idempotent', () => {
	const fixture = setup(); fixture.coordinator.start(); fixture.coordinator.dispose(); fixture.coordinator.dispose();
	expect(fixture.document.removeEventListener).toHaveBeenCalledTimes(5);
});

test('a reused video element with a new source aborts stale video work', () => {
	const fixture = setup();
	const oldSignal = fixture.coordinator.videoSignal;
	fixture.video.src = 'blob:video-next';
	fixture.video.currentSrc = 'blob:video-next';
	fixture.video.emit('loadstart');
	expect(oldSignal.aborted).toBe(true);
	expect(fixture.coordinator.videoSignal.aborted).toBe(false);
	fixture.coordinator.dispose();
});

test('uses WebKit presentation mode when standard PiP APIs are unavailable', async () => {
	const fixture = setup();
	fixture.document.pictureInPictureEnabled = false;
	const video = fixture.video;
	video.webkitPresentationMode = 'inline';
	video.webkitSupportsPresentationMode = jest.fn(() => true);
	video.webkitSetPresentationMode = jest.fn(mode => { video.webkitPresentationMode = mode; });
	expect(await fixture.coordinator.requestPiP()).toBe(true);
	expect(video.webkitSetPresentationMode).toHaveBeenCalledWith('picture-in-picture');
	expect(fixture.coordinator.pip).toBe('active');
	expect(await fixture.coordinator.exitPiP()).toBe(true);
	expect(video.webkitSetPresentationMode).toHaveBeenLastCalledWith('inline');
	expect(fixture.coordinator.pip).toBe('inactive');
	fixture.coordinator.dispose();
});
test('the state coordinator loads before the legacy player metadata initializer', () => {
	const fs = require('fs');
	const path = require('path');
	const initSource = fs.readFileSync(path.join(__dirname, '../../js&css/extension/init.js'), 'utf8');
	const listStart = initSource.indexOf('const pageWorldFiles = [');
	const listEnd = initSource.indexOf('\n];', listStart);
	expect(listStart).toBeGreaterThanOrEqual(0);
	expect(listEnd).toBeGreaterThan(listStart);
	const orderedFiles = initSource.slice(listStart, listEnd);
	expect(orderedFiles.indexOf('/js&css/web-accessible/state/player-state-coordinator.js'))
		.toBeLessThan(orderedFiles.indexOf('/js&css/web-accessible/www.youtube.com/player.js'));
});

test('yt-navigate-start aborts stale work immediately', () => {
	const fixture = setup();
	const routeSignal = fixture.coordinator.routeSignal;
	const videoSignal = fixture.coordinator.videoSignal;
	fixture.document.dispatchEvent({ type: 'yt-navigate-start' });
	expect(routeSignal.aborted).toBe(true);
	expect(videoSignal.aborted).toBe(true);
	expect(fixture.coordinator.routeSignal.aborted).toBe(false);
	fixture.coordinator.dispose();
});

/* PlayerStateCoordinator: classic-script compatible, dependency-injected player lifecycle. */
(function (root, factory) {
	'use strict';
	const PlayerStateCoordinator = factory();
	if (typeof module === 'object' && module.exports) module.exports = PlayerStateCoordinator;
	if (root && root.ImprovedTube && !root.ImprovedTube.stateCoordinator) {
		const app = root.ImprovedTube;
		const coordinator = new PlayerStateCoordinator({
			document: root.document, window: root,
			getVideo: () => app.elements?.video || root.document.querySelector('#movie_player video.html5-main-video'),
			getPlayer: () => app.elements?.player, getSettings: () => app.storage || {},
			onFocusChange: focused => { app.focus = focused; }
		});
		app.PlayerStateCoordinator = PlayerStateCoordinator;
		app.stateCoordinator = coordinator;
		coordinator.start();
	}
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	const PLAYBACK_STATES = new Set(['unstarted', 'buffering', 'playing', 'paused', 'ended', 'seeking']);
	class PlayerStateCoordinator {
		constructor({ document, window, getVideo, getPlayer, getSettings, onFocusChange } = {}) {
			if (!document || typeof getVideo !== 'function' || typeof getSettings !== 'function') throw new TypeError('PlayerStateCoordinator dependencies missing');
			this.document = document; this.window = window || document.defaultView;
			this.MutationObserver = this.window?.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
			this.getVideo = getVideo; this.getPlayer = getPlayer || (() => null);
			this.getSettings = getSettings; this.onFocusChange = onFocusChange || (() => {});
			this.playback = 'unstarted'; this.focus = document.visibilityState !== 'hidden' && document.hasFocus();
			this.pip = document.pictureInPictureElement ? 'active' : 'inactive'; this.transition = 'idle';
			this.video = null; this.wasPlayingBeforeBlur = false; this.routeKey = this._routeKey();
			this.transitionEpoch = 0; this.started = false; this.disposed = false;
			this.videoAbortController = null; this.videoCleanup = []; this.observer = null;
			this._boundRoute = this._onRoute.bind(this); this._boundVisibility = this._onVisibility.bind(this);
			this._boundPiPEnter = () => { this.pip = 'active'; this.transition = 'idle'; };
			this._boundPiPLeave = () => { this.pip = 'inactive'; this.transition = 'idle'; };
		}
		start() {
			if (this.started || this.disposed) return this;
			this.started = true;
			['yt-navigate-finish', 'spf:navigate'].forEach(type => this.document.addEventListener(type, this._boundRoute));
			this.document.addEventListener('visibilitychange', this._boundVisibility);
			this.document.addEventListener('enterpictureinpicture', this._boundPiPEnter, true);
			this.document.addEventListener('leavepictureinpicture', this._boundPiPLeave, true);
			if (this.MutationObserver && this.document.documentElement) {
				this.observer = new this.MutationObserver(() => this._attachCurrentVideo());
				this.observer.observe(this.document.documentElement, { childList: true, subtree: true });
			}
			this._attachCurrentVideo(); return this;
		}
		_routeKey() { return this.window?.location?.href || ''; }
		_onRoute() {
			const next = this._routeKey(); if (next === this.routeKey) return;
			this.routeKey = next; this.transitionEpoch++; this.transition = 'idle';
			this._detachVideo(); this.playback = 'unstarted'; this.wasPlayingBeforeBlur = false; this._attachCurrentVideo();
		}
		_onVisibility() { this.setFocus(this.document.visibilityState !== 'hidden' && this.document.hasFocus()); }
		_attachCurrentVideo() {
			if (this.disposed) return;
			let next = null; try { next = this.getVideo(); } catch (error) { this._report(error); }
			if (next === this.video) return;
			this._detachVideo(); this.video = next || null; if (!this.video) return;
			this.playback = this.video.ended ? 'ended' : this.video.paused ? 'paused' : 'playing';
			const attachedVideo = this.video;
			const controller = typeof AbortController === 'function' ? new AbortController() : null;
			this.videoAbortController = controller;
			const events = { loadstart: 'unstarted', waiting: 'buffering', stalled: 'buffering', playing: 'playing', play: 'playing', pause: 'paused', ended: 'ended', seeking: 'seeking', seeked: () => attachedVideo.paused ? 'paused' : 'playing', emptied: 'unstarted' };
			Object.entries(events).forEach(([type, state]) => {
				const listener = () => this._setPlayback(typeof state === 'function' ? state() : state);
				try { attachedVideo.addEventListener(type, listener, controller ? { signal: controller.signal } : false); }
				catch (_) { attachedVideo.addEventListener(type, listener); }
				this.videoCleanup.push(() => attachedVideo.removeEventListener(type, listener));
			});
		}
		_detachVideo() {
			if (this.videoAbortController) this.videoAbortController.abort();
			this.videoAbortController = null; this.videoCleanup.splice(0).forEach(fn => fn()); this.video = null;
		}
		_setPlayback(state) { if (PLAYBACK_STATES.has(state)) this.playback = state; }
		setFocus(focused) {
			const next = Boolean(focused); if (this.focus === next || this.disposed) return Promise.resolve();
			this.focus = next; this.onFocusChange(next); const epoch = ++this.transitionEpoch;
			return this._reconcileFocus(epoch);
		}
		async _reconcileFocus(epoch) {
			const video = this.video || this.getVideo(); const settings = this.getSettings() || {};
			const autoPip = settings.player_autoPip === true;
			const autoPause = settings.player_autopause_when_switching_tabs === true;
			const pipOutside = settings.player_autoPip_outside === true;
			if (!video) return;
			if (!this.focus) {
				this.wasPlayingBeforeBlur = !video.paused && !video.ended;
				if (autoPip && this.wasPlayingBeforeBlur) {
					const entered = await this.requestPiP(epoch);
					if (epoch !== this.transitionEpoch || this.focus) { if (this.focus && pipOutside) await this.exitPiP(); return; }
					if (entered) return;
				}
				if (autoPause && this.wasPlayingBeforeBlur && !video.paused) { this.transition = 'pausing'; this._pause(video); }
				return;
			}
			if (autoPip && pipOutside && this.document.pictureInPictureElement === video) await this.exitPiP();
			if (epoch !== this.transitionEpoch) return;
			if (autoPause && this.wasPlayingBeforeBlur && video.paused && !video.ended) { this.transition = 'resuming'; this._play(video); }
			this.wasPlayingBeforeBlur = false;
		}
		async requestPiP(epoch = this.transitionEpoch) {
			const video = this.video || this.getVideo();
			if (!video || !this.document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== 'function') return false;
			if (this.document.pictureInPictureElement === video || this.transition === 'entering-pip') return true;
			this.transition = 'entering-pip';
			try {
				await video.requestPictureInPicture(); this.pip = 'active';
				if (epoch !== this.transitionEpoch && this.focus && this.getSettings().player_autoPip_outside === true) await this.exitPiP();
				if (this.transition === 'entering-pip') this.transition = 'idle'; return true;
			} catch (error) { this.pip = 'inactive'; this.transition = 'idle'; this._report(error); return false; }
		}
		async exitPiP() {
			if (!this.document.pictureInPictureElement || typeof this.document.exitPictureInPicture !== 'function') return false;
			if (this.transition === 'exiting-pip') return true; this.transition = 'exiting-pip';
			try { await this.document.exitPictureInPicture(); this.pip = 'inactive'; this.transition = 'idle'; return true; }
			catch (error) { this.transition = 'idle'; this._report(error); return false; }
		}
		_pause(video) {
			try { const player = this.getPlayer(); if (player?.pauseVideo) player.pauseVideo(); else video.pause(); }
			catch (error) { this._report(error); } this.transition = 'idle';
		}
		_play(video) {
			try { const player = this.getPlayer(); const result = player?.playVideo ? player.playVideo() : video.play(); if (result?.catch) result.catch(error => this._report(error)); }
			catch (error) { this._report(error); } this.transition = 'idle';
		}
		_report(error) { this.window?.console?.warn?.('[ImprovedTube] Player state transition failed', error); }
		dispose() {
			if (this.disposed) return; this.disposed = true; this.transitionEpoch++; this._detachVideo();
			this.observer?.disconnect();
			['yt-navigate-finish', 'spf:navigate'].forEach(type => this.document.removeEventListener(type, this._boundRoute));
			this.document.removeEventListener('visibilitychange', this._boundVisibility);
			this.document.removeEventListener('enterpictureinpicture', this._boundPiPEnter, true);
			this.document.removeEventListener('leavepictureinpicture', this._boundPiPLeave, true);
			this.transition = 'disposed';
		}
	}
	return PlayerStateCoordinator;
});

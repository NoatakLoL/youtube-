/* PlayerStateCoordinator: page-world state machine and cancellation boundary. */
(function (root, factory) {
	'use strict';
	const API = factory();
	if (typeof module === 'object' && module.exports) module.exports = API;
	if (root && root.ImprovedTube && !root.ImprovedTube.stateCoordinator) {
		const app = root.ImprovedTube;
		const coordinator = new API({
			document: root.document, window: root,
			getVideo: () => app.elements?.video || root.document.querySelector('#movie_player video.html5-main-video'),
			getPlayer: () => app.elements?.player, getSettings: () => app.storage || {},
			onFocusChange: focused => { app.focus = focused; }
		});
		app.PlayerStateCoordinator = API;
		app.stateCoordinator = coordinator;
		coordinator.start();
	}
})(typeof window !== 'undefined' ? window : null, function () {
	'use strict';
	const PLAYBACK_STATES = new Set(['unstarted', 'buffering', 'playing', 'paused', 'ended', 'seeking']);
	const makeController = () => typeof AbortController === 'function' ? new AbortController() : null;

	class PlayerStateCoordinator {
		constructor({ document, window, getVideo, getPlayer, getSettings, onFocusChange } = {}) {
			if (!document || typeof getVideo !== 'function' || typeof getSettings !== 'function') {
				throw new TypeError('PlayerStateCoordinator dependencies missing');
			}
			this.document = document;
			this.window = window || document.defaultView;
			this.MutationObserver = this.window?.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
			this.getVideo = getVideo;
			this.getPlayer = getPlayer || (() => null);
			this.getSettings = getSettings;
			this.onFocusChange = onFocusChange || (() => {});
			this.playback = 'unstarted';
			this.focus = document.visibilityState !== 'hidden' && (typeof document.hasFocus !== 'function' || document.hasFocus());
			this.pip = document.pictureInPictureElement ? 'active' : 'inactive';
			this.transition = 'idle';
			this.video = null;
			this.videoSource = '';
			this.wasPlayingBeforeBlur = false;
			this.routeKey = this._routeKey();
			this.routeEpoch = 0;
			this.transitionEpoch = 0;
			this.routePending = false;
			this.started = false;
			this.disposed = false;
			this.routeController = makeController();
			this.videoController = makeController();
			this.videoCleanup = [];
			this.observer = null;
			this._boundRoute = this._onRoute.bind(this);
			this._boundVisibility = this._onVisibility.bind(this);
			this._boundPiPEnter = () => { this.pip = 'active'; this.transition = 'idle'; };
			this._boundPiPLeave = () => { this.pip = 'inactive'; this.transition = 'idle'; };
		}
		get routeSignal() { return this.routeController?.signal; }
		get videoSignal() { return this.videoController?.signal || this.routeSignal; }
		get signal() { return this.videoSignal; }
		start() {
			if (this.started || this.disposed) return this;
			this.started = true;
			this.document.addEventListener('yt-navigate-finish', this._boundRoute);
			this.document.addEventListener('spf:navigate', this._boundRoute);
			this.document.addEventListener('visibilitychange', this._boundVisibility);
			this.document.addEventListener('enterpictureinpicture', this._boundPiPEnter, true);
			this.document.addEventListener('leavepictureinpicture', this._boundPiPLeave, true);
			if (this.MutationObserver && this.document.documentElement) {
				this.observer = new this.MutationObserver(() => this._attachCurrentVideo('mutation'));
				this.observer.observe(this.document.documentElement, { childList: true, subtree: true });
			}
			this._attachCurrentVideo('start');
			return this;
		}
		_routeKey() { return this.window?.location?.href || ''; }
		_emit(name, detail) {
			if (typeof this.window?.CustomEvent === 'function') {
				this.document.dispatchEvent(new this.window.CustomEvent(name, { detail }));
			}
		}
		_beginRoute(reason) {
			const previousSignal = this.routeSignal;
			if (this.routeController && !this.routeController.signal.aborted) this.routeController.abort(reason || 'route-change');
			if (this.videoController && !this.videoController.signal.aborted) this.videoController.abort(reason || 'route-change');
			this._emit('ytplus:routewillchange', { url: this.routeKey, reason, signal: previousSignal });
			this.routeController = makeController();
			this.videoController = makeController();
			this.routeEpoch++;
			this.transitionEpoch++;
			this.transition = 'idle';
			this._detachVideo(false);
			this.playback = 'unstarted';
			this.wasPlayingBeforeBlur = false;
		}
		_onRoute(event) {
			if (this.disposed) return;
			const next = this._routeKey();
			if (event?.type === 'spf:navigate') {
				if (!this.routePending) this._beginRoute('spf:navigate');
				this.routePending = true;
				return;
			}
			if (this.routePending) {
				this.routePending = false;
				this.routeKey = next;
				this._emit('ytplus:routechange', { url: next, epoch: this.routeEpoch, signal: this.routeSignal });
				this._attachCurrentVideo('navigation');
				return;
			}
			if (next === this.routeKey) return;
			this._beginRoute('yt-navigate-finish');
			this.routeKey = next;
			this._emit('ytplus:routechange', { url: next, epoch: this.routeEpoch, signal: this.routeSignal });
			this._attachCurrentVideo('navigation');
		}
		_onVisibility() {
			const visible = this.document.visibilityState !== 'hidden';
			const focused = typeof this.document.hasFocus !== 'function' || this.document.hasFocus();
			this.setFocus(visible && focused);
		}
		_attachCurrentVideo(reason) {
			if (this.disposed) return;
			let next = null;
			try { next = this.getVideo(); } catch (error) { this._report(error); }
			const nextSource = this._sourceKey(next);
			if (next === this.video && nextSource === this.videoSource) return;
			const previousVideo = this._detachVideo(true);
			this.video = next || null;
			this.videoSource = nextSource;
			this.videoController = makeController();
			if (this.video) {
				this.playback = this.video.ended ? 'ended' : this.video.paused ? 'paused' : 'playing';
				const attachedVideo = this.video;
				const events = {
					loadstart: 'unstarted', waiting: 'buffering', stalled: 'buffering',
					playing: 'playing', play: 'playing', pause: 'paused', ended: 'ended',
					seeking: 'seeking', seeked: () => attachedVideo.paused ? 'paused' : 'playing',
					emptied: 'unstarted'
				};
				Object.entries(events).forEach(([type, state]) => {
					const listener = () => {
						if ((type === 'loadstart' || type === 'emptied') && this._sourceKey(attachedVideo) !== this.videoSource) {
							this._attachCurrentVideo('video-source-change');
							return;
						}
						this._setPlayback(typeof state === 'function' ? state() : state);
					};
					try {
						attachedVideo.addEventListener(type, listener, this.videoController ? { signal: this.videoController.signal } : false);
					} catch (_) {
						attachedVideo.addEventListener(type, listener);
					}
					this.videoCleanup.push(() => attachedVideo.removeEventListener(type, listener));
				});
			}
			this._emit('ytplus:videochange', {
				video: this.video, previousVideo, reason,
				routeSignal: this.routeSignal, signal: this.videoSignal,
				routeEpoch: this.routeEpoch
			});
		}
		_sourceKey(video) {
			if (!video) return '';
			return video.currentSrc || (video.getAttribute && video.getAttribute('src')) || video.src || '';
		}
		_detachVideo(abortController = true) {
			const previousVideo = this.video;
			if (abortController && this.videoController && !this.videoController.signal.aborted) this.videoController.abort('video-change');
			this.videoCleanup.splice(0).forEach(cleanup => {
				try { cleanup(); } catch (error) { this._report(error); }
			});
			this.video = null;
			this.videoSource = '';
			return previousVideo;
		}
		_setPlayback(state) { if (PLAYBACK_STATES.has(state)) this.playback = state; }
		setFocus(focused) {
			const next = Boolean(focused);
			if (this.focus === next || this.disposed) return Promise.resolve();
			this.focus = next;
			this.onFocusChange(next);
			const epoch = ++this.transitionEpoch;
			this._emit('ytplus:focuschange', { focused: next });
			return this._reconcileFocus(epoch);
		}
		async _reconcileFocus(epoch) {
			const video = this.video || this.getVideo();
			const settings = this.getSettings() || {};
			const autoPip = settings.player_autoPip === true;
			const autoPause = settings.player_autopause_when_switching_tabs === true;
			const pipOutside = settings.player_autoPip_outside === true;
			if (!video) return;
			if (!this.focus) {
				this.wasPlayingBeforeBlur = !video.paused && !video.ended;
				if (autoPip && this.wasPlayingBeforeBlur) {
					const entered = await this.requestPiP(epoch);
					if (epoch !== this.transitionEpoch || this.focus) {
						if (this.focus && pipOutside) await this.exitPiP();
						return;
					}
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
				await video.requestPictureInPicture();
				this.pip = 'active';
				if (epoch !== this.transitionEpoch && this.focus && this.getSettings().player_autoPip_outside === true) await this.exitPiP();
				if (this.transition === 'entering-pip') this.transition = 'idle';
				return true;
			} catch (error) { this.pip = 'inactive'; this.transition = 'idle'; this._report(error); return false; }
		}
		async exitPiP() {
			if (!this.document.pictureInPictureElement || typeof this.document.exitPictureInPicture !== 'function') return false;
			if (this.transition === 'exiting-pip') return true;
			this.transition = 'exiting-pip';
			try {
				await this.document.exitPictureInPicture();
				this.pip = 'inactive';
				this.transition = 'idle';
				return true;
			} catch (error) {
				this.transition = 'idle';
				this._report(error);
				return false;
			}
		}
		_pause(video) {
			try {
				const player = this.getPlayer();
				if (player?.pauseVideo) player.pauseVideo();
				else video.pause();
			} catch (error) {
				this._report(error);
			}
			this.transition = 'idle';
		}
		_play(video) {
			try {
				const player = this.getPlayer();
				const result = player?.playVideo ? player.playVideo() : video.play();
				if (result?.catch) result.catch(error => this._report(error));
			} catch (error) { this._report(error); }
			this.transition = 'idle';
		}
		_report(error) { this.window?.console?.warn?.('[ImprovedTube] Player state transition failed', error); }
		dispose() {
			if (this.disposed) return;
			this.disposed = true;
			this.transitionEpoch++;
			this.routeController?.abort('disposed');
			this.videoController?.abort('disposed');
			this._detachVideo(false);
			this.observer?.disconnect();
			this.document.removeEventListener('yt-navigate-finish', this._boundRoute);
			this.document.removeEventListener('spf:navigate', this._boundRoute);
			this.document.removeEventListener('visibilitychange', this._boundVisibility);
			this.document.removeEventListener('enterpictureinpicture', this._boundPiPEnter, true);
			this.document.removeEventListener('leavepictureinpicture', this._boundPiPLeave, true);
			this.transition = 'disposed';
		}
	}
	return PlayerStateCoordinator;
});

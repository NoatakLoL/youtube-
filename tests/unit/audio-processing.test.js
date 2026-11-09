const audio = require('../../js&css/web-accessible/features/audio');

test('Night Mode enables the compressor profile only when audio processing is enabled', () => {
	expect(audio.compressorProfile({ ytplus_audio_enabled: true, ytplus_audio_preset: 'night' })).toEqual({
		threshold: -26,
		knee: 24,
		ratio: 4
	});
	expect(audio.compressorProfile({ ytplus_audio_enabled: true, ytplus_audio_preset: 'flat' }).ratio).toBe(1);
	expect(audio.compressorProfile({ ytplus_audio_enabled: false, ytplus_audio_preset: 'night' }).ratio).toBe(1);
});

test('all advertised equalizer presets are exported', () => {
	expect(audio.presets).toEqual(['flat', 'voice', 'bass', 'treble', 'night']);
});


test('disabling equalizer restores a neutral, audible graph without suspending its context', async () => {
	const param = () => ({ setTargetAtTime: jest.fn() });
	const graph = {
		context: { currentTime: 2, resume: jest.fn(() => Promise.resolve()), suspend: jest.fn(() => Promise.resolve()) },
		filters: Array.from({ length: 5 }, () => ({ gain: param() })),
		gain: { gain: param() },
		compressor: { threshold: param(), knee: param(), ratio: param() }
	};
	await audio.deactivate(graph);
	expect(graph.context.resume).toHaveBeenCalledTimes(1);
	expect(graph.context.suspend).not.toHaveBeenCalled();
	expect(graph.gain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 2, 0.05);
	expect(graph.compressor.ratio.setTargetAtTime).toHaveBeenCalledWith(1, 2, 0.05);
});

test('zero gain is represented as silence rather than silently replaced with unity gain', () => {
	const param = () => ({ setTargetAtTime: jest.fn() });
	const graph = {
		context: { currentTime: 2 },
		filters: Array.from({ length: 5 }, () => ({ gain: param() })),
		gain: { gain: param() },
		compressor: { threshold: param(), knee: param(), ratio: param() }
	};
	audio.apply(graph, { ytplus_audio_enabled: true, ytplus_audio_gain: 0, ytplus_audio_preset: 'flat' });
	expect(graph.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.05);
});

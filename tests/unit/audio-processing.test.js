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

class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.instrument = 'piano'; // Default
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Reverb Effect
            this.reverb = this.ctx.createConvolver();
            this.reverb.buffer = this.createReverbBuffer();
            this.reverbGain = this.ctx.createGain();
            this.reverbGain.gain.value = 0.3; // Wet level

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;

            // Connect graph: Osc -> Master -> Destination
            //                    -> Reverb -> Master

            // Actually, usually it's Osc -> Master -> Dest
            //                             -> Reverb -> Dest (Parallel)
            // Or Osc -> DryGain -> Dest
            //        -> Reverb -> WetGain -> Dest

            // Let's do: Source -> Master -> Destination
            //                  -> Reverb -> Destination (Added)

            this.masterGain.connect(this.ctx.destination);
            this.masterGain.connect(this.reverb);
            this.reverb.connect(this.reverbGain);
            this.reverbGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    createReverbBuffer() {
        // Generate a simple impulse response
        const rate = this.ctx.sampleRate;
        const length = rate * 2.0; // 2 seconds
        const decay = 2.0;
        const buffer = this.ctx.createBuffer(2, length, rate);
        const channelDataLeft = buffer.getChannelData(0);
        const channelDataRight = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
             // Noise
             const noise = (Math.random() * 2 - 1);
             // Decay
             const k = Math.pow(1 - i / length, decay);

             channelDataLeft[i] = noise * k;
             channelDataRight[i] = noise * k;
        }
        return buffer;
    }

    setInstrument(inst) {
        this.instrument = inst;
    }

    playNote(frequency = 440, type = 'hit') {
        if (!this.ctx) return;

        // Visual feedback usually happens in game loop, this is just audio
        switch (this.instrument) {
            case 'piano':
                this.playPiano(frequency);
                break;
            case 'guitar':
                this.playGuitar(frequency);
                break;
            case 'drums':
                // For drums, frequency might map to different drum parts
                // But for a rhythm game falling notes, we might want melodic tones
                // OR specific drum sounds based on the lane.
                // Let's stick to melodic tones for gameplay feedback,
                // or specific sounds if type is 'miss'.
                this.playSynth(frequency, 'square');
                break;
            default:
                this.playPiano(frequency);
        }
    }

    playPiano(freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    playGuitar(freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Filter for "pluck" sound
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + 0.1);
        filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.8);
    }

    playSynth(freq, type) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playMiss() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // UI Elements
        this.menuOverlay = document.getElementById('menu-overlay');
        this.hudOverlay = document.getElementById('hud-overlay');
        this.gameoverOverlay = document.getElementById('gameover-overlay');
        this.scoreEl = document.getElementById('score');
        this.comboEl = document.getElementById('combo');
        this.finalScoreEl = document.getElementById('final-score');
        this.maxComboEl = document.getElementById('max-combo');
        this.healthBarEl = document.getElementById('health-bar');
        this.feverBarEl = document.getElementById('fever-bar');
        this.feverContainerEl = document.getElementById('fever-container');
        this.menuHighScoreEl = document.getElementById('menu-highscore');
        this.detectedNoteEl = document.getElementById('detected-note');

        window.addEventListener('resize', () => this.resize());

        // Game State
        this.state = 'MENU'; // MENU, PLAYING, GAMEOVER
        this.startTime = 0;
        this.audio = new SoundManager();
        this.currentSong = null;
        this.activeNotes = [];
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.health = 100;
        this.fever = 0;
        this.feverActive = false;
        this.feverTimer = 0;

        this.feedbackTexts = [];
        this.particles = [];
        this.backgroundPulse = 0;

        this.selectedInstrument = 'piano';
        this.selectedSong = 'song1';

        // Configuration
        this.laneCount = 4;
        this.noteSpeed = 0.5; // Pixels per ms
        this.hitLineOffset = 150; // Pixels from bottom

        // Colors
        this.laneColors = ['#ff0055', '#00f0ff', '#00ff00', '#ffff00'];
        this.noteNames = ['DO', 'RE', 'MI', 'SOL'];

        this.resize();
        this.initInput();
        this.initMenu();

        this.micContext = null;
        this.micAnalyser = null;
        this.micBuffer = null;
        this.micSource = null;

        // Auto-request Mic on load
        setTimeout(() => this.initMicrophone(), 1000);
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.laneWidth = this.canvas.width / this.laneCount;
        this.hitLineY = this.canvas.height - this.hitLineOffset;
    }

    initMenu() {
        // Instrument Selection
        document.querySelectorAll('#instrument-select .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#instrument-select .btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedInstrument = e.target.dataset.value;
            });
        });

        // Song Selection
        document.querySelectorAll('#song-select .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#song-select .btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedSong = e.target.dataset.value;
            });
        });

        // Start Button
        document.getElementById('btn-start').addEventListener('click', () => {
            this.start(this.selectedSong, this.selectedInstrument);
        });

        // Mic Test
        document.getElementById('btn-mic-test').addEventListener('click', () => {
            this.testMicrophone();
        });

        this.updateMenuHighScore();

        // Menu Button (in-game)
        document.getElementById('btn-menu').addEventListener('click', () => {
            this.showMenu();
        });

        // Game Over Buttons
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.start(this.selectedSong, this.selectedInstrument);
        });

        document.getElementById('btn-return-menu').addEventListener('click', () => {
            this.showMenu();
        });
    }

    initInput() {
        // Touch Input
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                this.handleInput(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            }
        }, { passive: false });

        // Mouse Input
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleInput(e.clientX, e.clientY);
        });

        // Keyboard Input (D F J K or 1 2 3 4)
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') return;

            const keyMap = {
                'd': 0, 'f': 1, 'j': 2, 'k': 3,
                '1': 0, '2': 1, '3': 2, '4': 3,
                'ArrowLeft': 0, 'ArrowDown': 1, 'ArrowUp': 2, 'ArrowRight': 3
            };

            if (keyMap.hasOwnProperty(e.key.toLowerCase())) {
                this.checkHit(keyMap[e.key.toLowerCase()]);
            }
        });
    }

    handleInput(x, y) {
        if (this.state !== 'PLAYING') return;

        // Calculate which lane was tapped
        // We need to account for canvas position if it's not full screen (though css makes it full)
        const rect = this.canvas.getBoundingClientRect();
        const relativeX = x - rect.left;

        const laneIndex = Math.floor(relativeX / this.laneWidth);
        if (laneIndex >= 0 && laneIndex < this.laneCount) {
            this.checkHit(laneIndex);
        }
    }

    checkHit(laneIndex) {
        // Find the note in this lane that is closest to the hit line
        const currentTime = performance.now() - this.startTime;

        // Filter notes in this lane that haven't been hit/missed yet
        const candidates = this.activeNotes.filter(n => n.lane === laneIndex && !n.hit && !n.missed);

        if (candidates.length === 0) return;

        // Sort by time (should be sorted already, but just in case)
        candidates.sort((a, b) => a.time - b.time);

        const targetNote = candidates[0];
        const timeDiff = Math.abs(currentTime - targetNote.time);

        // Hit Windows (ms)
        const perfectWindow = 70;
        const goodWindow = 150;
        const missWindow = 250;

        if (timeDiff <= perfectWindow) {
            this.registerHit(targetNote, 'PERFECT', 100);
        } else if (timeDiff <= goodWindow) {
            this.registerHit(targetNote, 'GOOD', 50);
        } else if (timeDiff <= missWindow) {
             this.triggerMiss(targetNote);
        }
    }

    registerHit(note, type, points) {
        note.hit = true;

        let multiplier = 1;
        if (this.feverActive) multiplier = 2;
        if (note.type === 'GOLD') {
             multiplier *= 2;
             this.health = Math.min(100, this.health + 10);
        }

        this.score += (points + (this.combo * 10)) * multiplier;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        this.health = Math.min(100, this.health + 2);

        // Fever Logic
        if (!this.feverActive) {
            this.fever = Math.min(100, this.fever + (note.type === 'GOLD' ? 20 : 5));
            if (this.fever >= 100) {
                this.activateFever();
            }
        }

        this.updateHUD();

        let color = type === 'PERFECT' ? '#00f0ff' : '#00ff00';
        if (note.type === 'GOLD') color = '#ffd700';

        this.spawnFeedback(type, color);
        this.spawnParticles(note.lane * this.laneWidth + this.laneWidth / 2, this.hitLineY, color);
        this.backgroundPulse = 1.0;

        const freqs = [261.63, 293.66, 329.63, 392.00];
        this.audio.playNote(freqs[note.lane], 'hit');
    }

    activateFever() {
        this.feverActive = true;
        this.feverTimer = 500; // Frames or time units? Let's use Update ticks for simplicity or time
        this.spawnFeedback("FEVER!", "#ff00ff");
    }

    triggerMiss(note) {
        note.missed = true;
        this.combo = 0;
        this.health = Math.max(0, this.health - 15); // Damage

        this.updateHUD();
        this.spawnFeedback('MISS', '#ff0055');
        this.audio.playMiss();

        if (this.health <= 0) {
            this.endGame();
        }
    }

    spawnFeedback(text, color) {
        this.feedbackTexts.push({
            text: text,
            color: color,
            x: this.canvas.width / 2,
            y: this.hitLineY - 50,
            life: 1.0,
            velocity: -1
        });
    }

    spawnParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: color
            });
        }
    }

    updateHUD() {
        this.scoreEl.textContent = `Score: ${this.score}`;
        this.comboEl.textContent = `Combo: ${this.combo}`;
        this.healthBarEl.style.width = `${this.health}%`;

        if (this.health > 50) {
            this.healthBarEl.style.background = 'linear-gradient(90deg, #ff3333, #00ff00)';
        } else {
             this.healthBarEl.style.background = 'linear-gradient(90deg, #ff3333, #ffaa00)';
        }

        this.feverBarEl.style.width = `${this.fever}%`;

        if (this.feverActive) {
            this.feverContainerEl.classList.add('active');
        } else {
            this.feverContainerEl.classList.remove('active');
        }
    }

    updateMenuHighScore() {
        const key = `highscore_${this.selectedSong}`;
        const highScore = localStorage.getItem(key) || 0;
        this.menuHighScoreEl.textContent = highScore;
    }

    showMenu() {
        this.state = 'MENU';
        this.updateMenuHighScore();
        this.menuOverlay.classList.remove('hidden');
        this.hudOverlay.classList.add('hidden');
        this.gameoverOverlay.classList.add('hidden');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    start(songKey, instrument) {
        try {
            this.audio.init();
            this.audio.setInstrument(instrument);
        } catch (e) {
            console.error("Audio init failed:", e);
        }

        const songData = SONGS[songKey];
        this.currentSong = {
            ...songData,
            notes: JSON.parse(JSON.stringify(songData.notes))
        };

        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.health = 100;
        this.activeNotes = [];
        this.feedbackTexts = [];
        this.particles = [];
        this.state = 'PLAYING';
        this.startTime = performance.now();

        this.menuOverlay.classList.add('hidden');
        this.gameoverOverlay.classList.add('hidden');
        this.hudOverlay.classList.remove('hidden');
        this.updateHUD();

        this.loop();
    }

    loop() {
        if (this.state !== 'PLAYING') return;

        const currentTime = performance.now() - this.startTime;
        this.update(currentTime);
        this.draw(currentTime);

        requestAnimationFrame(() => this.loop());
    }

    update(currentTime) {
        // Spawn notes
        while (this.currentSong.notes.length > 0 &&
               this.currentSong.notes[0].time - 2000 < currentTime) {
            this.activeNotes.push(this.currentSong.notes.shift());
        }

        // Check missed notes (passed the line)
        const missThreshold = 200;

        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const note = this.activeNotes[i];

            // If already handled, remove if off screen
            if (note.hit || note.missed) {
                const timeDiff = currentTime - note.time;
                 if (timeDiff > 1000) {
                    this.activeNotes.splice(i, 1);
                }
                continue;
            }

            const timeDiff = currentTime - note.time; // Positive means past target

            if (timeDiff > missThreshold) {
                this.triggerMiss(note);
            }
        }

        // Update Feedback Texts
        for (let i = this.feedbackTexts.length - 1; i >= 0; i--) {
            const fb = this.feedbackTexts[i];
            fb.life -= 0.02;
            fb.y += fb.velocity;
            if (fb.life <= 0) {
                this.feedbackTexts.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Fever
        if (this.feverActive) {
            this.fever -= 0.2; // Drain fever
            if (this.fever <= 0) {
                this.feverActive = false;
                this.fever = 0;
            }
        }

        // Update Pulse
        if (this.backgroundPulse > 0) {
            this.backgroundPulse -= 0.05;
            if (this.backgroundPulse < 0) this.backgroundPulse = 0;
        }

        // Check End Game (No more notes to spawn AND no active notes)
        // We wait a bit after last note
        if (this.currentSong.notes.length === 0 && this.activeNotes.length === 0) {
             // Wait 1 second before showing game over
             setTimeout(() => this.endGame(), 1000);
             this.state = 'ENDING';
        }
    }

    draw(currentTime) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Background Pulse
        if (this.feverActive) {
            // Rainbow or specific color for Fever
            const hue = (Date.now() / 10) % 360;
            this.ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.1)`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.backgroundPulse > 0) {
            this.ctx.fillStyle = `rgba(0, 240, 255, ${this.backgroundPulse * 0.1})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw Lanes
        for (let i = 0; i < this.laneCount; i++) {
            const x = i * this.laneWidth;

            // Lane Background
            this.ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)';
            this.ctx.fillRect(x, 0, this.laneWidth, this.canvas.height);

            // Divider
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.stroke();

            // Hit Target Area
            this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
            this.ctx.fillRect(x + 5, this.hitLineY - 10, this.laneWidth - 10, 20);
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = this.laneColors[i];
            this.ctx.strokeRect(x + 5, this.hitLineY - 10, this.laneWidth - 10, 20);
        }

        // Draw Hit Line
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY);
        this.ctx.lineTo(this.canvas.width, this.hitLineY);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw Notes
        this.activeNotes.forEach(note => {
            const timeToHit = note.time - currentTime;
            const y = this.hitLineY - (timeToHit * this.noteSpeed);
            const x = note.lane * this.laneWidth;

            if (y > -50 && y < this.canvas.height + 50) {
                this.ctx.fillStyle = note.type === 'GOLD' ? '#ffd700' : this.laneColors[note.lane];

                // Visual effect for hit/miss could be here
                if (note.hit) {
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.fillStyle = '#fff'; // Flash white
                } else if (note.missed) {
                    this.ctx.globalAlpha = 0.2;
                    this.ctx.fillStyle = '#555'; // Grey out
                } else {
                    this.ctx.globalAlpha = 1.0;
                }

                // Add glow for gold notes
                if (note.type === 'GOLD') {
                    this.ctx.shadowBlur = 20;
                    this.ctx.shadowColor = '#ffd700';
                } else {
                    this.ctx.shadowBlur = 0;
                }

                this.roundRect(this.ctx, x + 10, y - 10, this.laneWidth - 20, 20, 5, true, false);
                this.ctx.shadowBlur = 0; // Reset

                // Draw Note Label
                this.ctx.fillStyle = '#000';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(this.noteNames[note.lane], x + this.laneWidth / 2, y);

                this.ctx.globalAlpha = 1.0;
            }
        });

        // Draw Feedback Texts
        this.feedbackTexts.forEach(fb => {
            this.ctx.save();
            this.ctx.globalAlpha = fb.life;
            this.ctx.font = 'bold 40px Arial';
            this.ctx.fillStyle = fb.color;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = fb.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillText(fb.text, fb.x, fb.y);
            this.ctx.restore();
        });

        // Draw Particles
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof stroke === 'undefined') { stroke = true; }
        if (typeof radius === 'undefined') { radius = 5; }
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }

    initMicrophone() {
        if (this.micContext) return; // Already init

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                console.log("Mic Permission Granted.");

                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.micContext = new AudioContext();
                this.micAnalyser = this.micContext.createAnalyser();
                this.micAnalyser.fftSize = 2048;
                this.micBuffer = new Float32Array(this.micAnalyser.fftSize);

                this.micSource = this.micContext.createMediaStreamSource(stream);
                this.micSource.connect(this.micAnalyser);

                // Start Pitch Detection Loop
                this.updatePitch();
            })
            .catch(err => {
                console.log("Mic Permission blocked/failed. User needs to enable it.");
            });
    }

    updatePitch() {
        if (!this.micAnalyser) return;

        this.micAnalyser.getFloatTimeDomainData(this.micBuffer);
        const ac = this.autoCorrelate(this.micBuffer, this.micContext.sampleRate);

        if (ac > -1) {
            const note = this.noteFromPitch(ac);
            const noteName = this.noteNames[note % 4]; // Simplified to 4 lanes for now, or use full scale
            // Actually, let's map realistic notes to names
            const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const noteNum = 12 * (Math.log(ac / 440) / Math.log(2)) + 69;
            const noteIndex = Math.round(noteNum) % 12;
            const fullNoteName = noteStrings[noteIndex];

            // Map to Do Re Mi for user friendliness if requested, but let's stick to simple first
            // User asked for "Nota que esta esse som"
            // Let's translate: C=Do, D=Re, E=Mi, F=Fa, G=Sol, A=La, B=Si
            const solfege = {
                "C": "DO", "C#": "DO#",
                "D": "RE", "D#": "RE#",
                "E": "MI",
                "F": "FA", "F#": "FA#",
                "G": "SOL", "G#": "SOL#",
                "A": "LA", "A#": "LA#",
                "B": "SI"
            };

            this.detectedNoteEl.textContent = solfege[fullNoteName] || fullNoteName;
            this.detectedNoteEl.style.color = '#00f0ff';
        } else {
             // Fade out or keep last?
             // this.detectedNoteEl.textContent = "...";
        }

        requestAnimationFrame(() => this.updatePitch());
    }

    autoCorrelate(buf, sampleRate) {
        // Implements the ACF2+ algorithm
        let SIZE = buf.length;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            const val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) // not enough signal
            return -1;

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++)
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < SIZE / 2; i++)
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        const c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++)
            for (let j = 0; j < SIZE - i; j++)
                c[i] = c[i] + buf[j] * buf[j + i];

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    }

    noteFromPitch(frequency) {
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
        return Math.round(noteNum);
    }

    // Kept for backward compatibility if needed, but replaced by initMicrophone logic
    requestMicPermission() {
         this.initMicrophone();
    }

    testMicrophone() {
        // Reuse the persistent analyzer if available, or just use the visualizer logic
        const visualizer = document.getElementById('mic-visualizer');
        const bar = document.getElementById('mic-bar');
        const btn = document.getElementById('btn-mic-test');

        visualizer.classList.remove('hidden');
        btn.textContent = "Testando...";

        // If we already have mic context running
        if (this.micAnalyser) {
            const updateVis = () => {
                if (visualizer.classList.contains('hidden')) return;
                const array = new Uint8Array(this.micAnalyser.frequencyBinCount);
                this.micAnalyser.getByteFrequencyData(array);
                let values = 0;
                for(let i=0; i<array.length; i++) values += array[i];
                const avg = values / array.length;
                bar.style.width = Math.min(100, avg * 2) + '%';
                requestAnimationFrame(updateVis);
            };
            updateVis();

            setTimeout(() => {
                visualizer.classList.add('hidden');
                btn.textContent = "Testar Microfone";
            }, 5000);
            return;
        }

        // Fallback if initMicrophone failed or wasn't called
        this.initMicrophone();
        // Give it a second to start then try testing again?
        // Or just let the user know to check permission.
    }

    endGame() {
        this.state = 'GAMEOVER';

        // Save High Score
        const key = `highscore_${this.selectedSong}`;
        const currentHighScore = parseInt(localStorage.getItem(key) || '0');
        if (this.score > currentHighScore) {
            localStorage.setItem(key, this.score);
        }

        this.finalScoreEl.textContent = this.score;
        this.maxComboEl.textContent = this.maxCombo;
        this.hudOverlay.classList.add('hidden');
        this.gameoverOverlay.classList.remove('hidden');
    }
}

const game = new Game();

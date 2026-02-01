const SONGS = {
    'tutorial': {
        name: 'Tutorial (Easy)',
        bpm: 60,
        difficulty: 'Easy',
        notes: []
    },
    'song1': {
        name: 'Neon Lights',
        bpm: 100,
        difficulty: 'Medium',
        notes: []
    },
    'song2': {
        name: 'Cyber Chase',
        bpm: 140,
        difficulty: 'Hard',
        notes: []
    },
    'song3': {
        name: 'Samba Beat',
        bpm: 130,
        difficulty: 'Hard',
        notes: []
    },
    'song4': {
        name: 'Baile Funk',
        bpm: 130,
        difficulty: 'Medium',
        notes: []
    }
};

// Helper to generate notes based on BPM
function generateNotes(songId) {
    const song = SONGS[songId];
    const msPerBeat = 60000 / song.bpm;
    const notes = [];
    const lanes = [0, 1, 2, 3];

    // Pattern generation
    let currentTime = 2000; // Start after 2 seconds

    // Simple pattern for 30 seconds
    for (let i = 0; i < 50; i++) {
        // Random lane or simple pattern
        let lane;

        if (songId === 'tutorial') {
             // Very slow, consistent 1-2-3-4
             lane = i % 4;
             notes.push({ time: currentTime, lane: lane, type: 'NORMAL' });
             currentTime += msPerBeat * 2; // Extra slow spacing
        } else if (songId === 'song1') {
            // Simple 1-2-3-4 pattern or random
            lane = i % 4;
            let type = 'NORMAL';
            if (i % 20 === 0) type = 'GOLD'; // Rare gold note

            notes.push({ time: currentTime, lane: lane, type: type });
            currentTime += msPerBeat;
        } else if (songId === 'song2') {
            // Faster, maybe double notes
            lane = Math.floor(Math.random() * 4);
            let type = 'NORMAL';
            if (i % 25 === 0) type = 'GOLD';

            notes.push({ time: currentTime, lane: lane, type: type });

            // Occasional double note
            if (i % 5 === 0) {
                notes.push({ time: currentTime, lane: (lane + 2) % 4, type: 'NORMAL' });
            }
            currentTime += msPerBeat / 2; // Twice as fast spawning
        } else if (songId === 'song3') {
            // Samba: Syncopated feel (skip beat occasionally)
            if (i % 4 !== 3) { // Skip every 4th 16th-note-ish beat for syncopation
                 lane = Math.floor(Math.random() * 4);
                 notes.push({ time: currentTime, lane: lane, type: 'NORMAL' });
            }
            // Burst
            if (i % 8 === 0) {
                 notes.push({ time: currentTime + msPerBeat/2, lane: Math.floor(Math.random()*4), type: 'GOLD' });
            }
            currentTime += msPerBeat;
        } else {
            // Funk: Heavy downbeat
            lane = Math.floor(Math.random() * 4);
            notes.push({ time: currentTime, lane: lane, type: 'NORMAL' });

            // Tamborzão beat mimic: Boom-Cha-Cha-Boom-Cha
            // Just randomized dense pattern
             if (i % 2 === 0) {
                 notes.push({ time: currentTime + msPerBeat/2, lane: (lane + 1) % 4, type: 'NORMAL' });
             }
            currentTime += msPerBeat;
        }
    }

    song.notes = notes;
    song.duration = currentTime + 3000; // End slightly after last note
}

generateNotes('tutorial');
generateNotes('song1');
generateNotes('song2');
generateNotes('song3');
generateNotes('song4');

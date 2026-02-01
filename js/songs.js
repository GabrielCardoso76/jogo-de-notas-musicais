const SONGS = {
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

        if (songId === 'song1') {
            // Simple 1-2-3-4 pattern or random
            lane = i % 4;
            let type = 'NORMAL';
            if (i % 20 === 0) type = 'GOLD'; // Rare gold note

            notes.push({ time: currentTime, lane: lane, type: type });
            currentTime += msPerBeat;
        } else {
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
        }
    }

    song.notes = notes;
    song.duration = currentTime + 3000; // End slightly after last note
}

generateNotes('song1');
generateNotes('song2');

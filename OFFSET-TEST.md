# YouTube offset diagnostic

Open `/player-test.html` on the same browser/device where Fake Cable exhibited the playback-offset problem.

The default specimen is Corridor Crew video `FpXQ0QTpKE0`, with a target offset of 1680 seconds (28:00).

Run the three tests separately, allowing roughly five seconds of playback after each starts:

1. **Load at target** — calls `loadVideoById({ videoId, startSeconds: 1680 })`, matching Fake Cable's normal loading strategy.
2. **Cue at target → Play** — calls `cueVideoById({ videoId, startSeconds: 1680 })`, waits briefly, then `playVideo()`.
3. **Load at 0 → delayed seek** — starts normally at zero, waits 1.5 seconds, then calls `seekTo(1680, true)`.

The page displays current playback time, requested time, difference, state changes, and errors. A strategy succeeds if playback settles near 28:00 rather than remaining near 0:00.

This page deliberately bypasses Fake Cable's scheduling, channel switching, static, guide, and playback controller so results isolate the YouTube IFrame API behavior.

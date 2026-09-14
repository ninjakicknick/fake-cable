# Fake Cable reliability pass

Status: published to `reliability-pass` after explicit user approval. Draft PR #14 is open and Vercel reports the deployment Ready. Modified-build browser verification remains blocked: the preview redirects to Vercel login, and the connected Vercel account is not authorized for this project scope. Production has not been changed by this work.

## Findings and changes

| Finding | Change |
| --- | --- |
| Refreshes, mix edits, and imports could discard current playback state while the video continued. Reordering regenerated schedules and changed program references. | One identity-based lineup reconciler retains unchanged schedules, anchors the on-air program during catalog/commercial changes, remaps selected/previous/current rows, and loads a fallback when the playing channel disappears. |
| Initial background rebuild could reopen the guide over ongoing playback. | Background completion respects whether the viewer is watching or browsing. |
| Schedules expired after their fixed broadcast window. | Renew before coverage runs out; retain an in-progress program. Empty sources do not trigger regeneration every second. |
| Clock transitions could close the guide, and Last could remember a highlighted row instead of the playing channel. | Preserve browsing during automatic transitions; derive Last from actual playback. Save the last channel by identity so reordering survives reload. |
| Different scheduled occurrences of the same video were treated as already tuned. | Compare program instances, and resume a paused tune using player recreation. |
| Stale player events could affect a replacement player/current program. | Ignore callbacks from replaced players and callbacks whose reported video differs from the requested video. |
| Quiet refreshes did not share the lineup edit lock. | Serialize background refresh with user edits; test a mix save attempted while a refresh is outstanding. |
| Corrupt JSON shapes, invalid last-channel numbers, or unavailable browser storage could prevent startup. | Validate channels/stations/mixes/commercials, recover defaults, clamp saved selection, and retain session changes if persistence fails. |
| Delayed events from the old phone could change connection UI or issue commands after replacement. A failed phone connection could leave the connecting latch set. | Ignore abandoned connection events, clear failed connections, allow bounded handshake time, replace stuck signalling peers, and restore controls from fresh status. |
| Phone search results retained an old connection. | Resolve the current connection when a result is selected. |
| Captions globally wrapped YouTube and PeerJS constructors, with command handling outside the pairing-key check. | Replace global interception with an explicit caption controller and the existing authenticated action/status path. |
| Sharing silently omitted playlist stations. | Include validated playlist identifiers in the existing sharing format. |
| A replacement source could inherit another source's custom name and blacklist by array position. | Preserve metadata only when source identity matches. |
| Fetches had no client deadline. | Add a 60-second deadline to station/search requests. |
| Global keyboard shortcuts could consume input intended for focused controls. | Respect editable fields, buttons, and dialogs. |
| Service-worker cache cleanup deleted unrelated caches. | Scope cleanup to Fake Cable shell caches, bump the cache, and include the new module. |

No visual redesign, extra settings, accounts, or monetization changes were introduced.

## Validation

- `npm test`: 83 passing tests, up from 59 at baseline.
- New DOM integration tests load the actual HTML and app module with simulated YouTube/network collaborators; cover reorder, consolidating mixes, end transitions with the guide open, corrupt-data startup, refresh preservation, and concurrent edit exclusion.
- New remote event tests cover invalid keys, replaced connections, stale statuses, retry after errors, and stuck signalling handshakes.
- Caption persistence, playlist sharing, storage denial, source metadata identity, stale player events, and repeated-video occurrences have regression coverage.
- Accelerated schedule simulation covers seven days. This is not a seven-day video playback soak.
- Existing static timeout/recovery tests remain green.
- Syntax and whitespace checks pass.
- Live production browser exercise covered startup, guide, returning to playback, reordering, creating a mix that hides sources, saved-lineup reload, phone remote layout/options, pairing-link creation, and manual reconnect. Initial refresh reopening the guide while old playback remained was observed.
- The test browser could not establish the peer data connection. Localhost access was blocked by the browser. Therefore real reconnect, updated-build visual/mobile verification, long-running real YouTube playback, and Samsung/DeX behavior are **not certified**.

The test-only dependency `jsdom` is locked; production remains plain JavaScript without a new runtime dependency.

## Remaining risks and product judgment

1. Restore authorized access to the protected deployment preview, exercise desktop/mobile layouts and real YouTube transitions there, and run two-device pairing/reconnection tests before merging. PR: https://github.com/ninjakicknick/fake-cable/pull/14. Preview: https://fake-cable-git-reliability-pass-ninjakicknick.vercel.app. This is the immediate incomplete validation gate.
2. TV reload still creates a new pairing session. Making an old phone link survive a TV reload needs a deliberate session-persistence design. This pass improves reconnection to the same TV session.
3. Sharing now retains playlist stations, but mixes, guide order, and commercial preferences still are not part of the shared payload. Decide whether “share lineup” should eventually mean the complete TV setup.
4. YouTube availability, duration estimates, autoplay policies, HTML parsing, and peer-network reachability remain external dependencies. Simulated callbacks cannot prove their behavior on a physical TV/phone.
5. Browser storage still uses multiple keys. The safe adapter prevents crashes and warns on persistence failure, but does not make a multi-key save atomic across quota failures or synchronize simultaneous TV tabs.
6. Duration corrections and the preserved in-progress schedule are local to the running session; schedules rebuild on reload. Cross-device/refresh-perfect continuity would need a separate persistence policy.
7. Restoring the starter lineup currently destroys personal additions after its existing confirmation. No undo feature was added.

Default decisions made here: preserve the on-air program when updating its catalog or commercials; when its channel disappears, load a remaining channel; keep the guide open through automatic program transitions. These are implemented behaviors, not additional questions or settings for the viewer.

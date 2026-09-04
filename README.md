# Fake Cable

Fake Cable turns public YouTube channels into a personal, always-on cable television lineup.

Every station follows a clock-driven schedule. Tune in late and the current program starts in the middle, then advances automatically—because television does not wait for you.

**Live app:** [fake-cable.vercel.app](https://fake-cable.vercel.app)

## What it does

- Builds stations from YouTube creators
- Searches for creators by name or accepts channel, handle, video, Shorts, and live links
- Creates deterministic daily schedules from recent videos
- Filters YouTube Shorts where public YouTube data allows it
- Tunes into the currently airing point instead of restarting the video
- Automatically advances to the next scheduled program
- Skips unavailable or non-embeddable videos
- Refreshes stale channel data while preserving the last working lineup
- Provides a television-style guide, now-playing banner, and on-screen remote
- Pairs with a phone through a QR code for account-free second-screen control
- Supports keyboard, pointer, touchscreen, fullscreen, and DeX-style use
- Installs as a Progressive Web App
- Stores everything locally in the browser
- Shares lineups through account-free links and locally generated QR codes

No Google Cloud project, YouTube API key, account connection, or backend database is required.

## Create your lineup

1. Open the app and select **Turn On the TV**.
2. Open **Settings** from the on-screen remote.
3. Search for a creator or paste a YouTube link.
4. Select **Add** beside the correct channel.
5. Repeat for up to 30 channels.

Channels are added immediately. Fake Cable saves the station list and generated programming in that browser's local storage.

The first build can take a little while because the server reads public YouTube data and checks recent video durations.

## Share a lineup

1. Open **Settings** and select **Share Lineup**.
2. Scan the QR code, copy the link, or use the device's Share menu.
3. Open the link on another device.
4. Review the incoming stations.
5. Choose **Add Missing** or **Replace Lineup**.

Shared links contain a compact, versioned list of YouTube channel IDs in the URL fragment. The lineup is not uploaded to Fake Cable or stored in a cloud account.

Large lineups automatically omit display labels from the payload to keep the QR code readable. YouTube restores the channel names while importing.

## Controls

| Control | Action |
| --- | --- |
| Arrow Up / Down | Move through the guide or change channels |
| Arrow Left / Right | Browse programs in the guide |
| Enter | Tune to the highlighted channel |
| G or Escape | Open or close the guide |
| F | Enter or leave fullscreen |
| M | Mute or restore sound |
| Space or Enter while watching | Show the current program banner |

The on-screen remote provides channel up/down, previous channel, guide, tune, fullscreen, mute, settings, and collapsible controls for devices without a keyboard.

## Use a phone as the remote

1. Start Fake Cable on the television.
2. Select **Pair Phone** on the opening screen or in Settings. You can also select **Pair** from the on-screen controls while watching.
3. Scan the QR code with the phone's camera.
4. Use the phone remote to surf channels, navigate the guide, jump directly to a station, view program information, or mute playback.

The QR code creates a short-lived, private browser-to-browser connection. Fake Cable does not require an account or upload the lineup. Both devices need internet access while pairing and must keep the Fake Cable page open. Disconnecting the phone or closing the television session ends control.

## Install the app

When the browser supports PWA installation, the welcome screen displays **Install App**. Installation gives Fake Cable its own launcher icon and standalone window.

The service worker caches the application shell. YouTube playback and channel refreshes still require an internet connection.

## Project structure

```text
index.html                   Page markup
styles.css                  Interface and responsive styles
app.js                      Player, guide, settings, and lineup behavior
schedule.js                 Pure deterministic scheduling functions
lineup-share.js             Shared-link encoding and validation
api/
  channels.js               YouTube search, resolution, parsing, and feeds
icons/                      PWA icons
vendor/
  qrcode.min.js             Vendored QRCode.js
  qrcode.LICENSE.txt        QRCode.js MIT license
  peerjs.min.js             Vendored PeerJS browser client
  peerjs.LICENSE.txt        PeerJS MIT license
test/
  schedule.test.js          Scheduling tests
  parsers.test.js           YouTube parser tests
  lineup-share.test.js      Shared-lineup codec tests
.github/workflows/test.yml   Automated test workflow
manifest.webmanifest         PWA metadata
sw.js                        Application-shell service worker
```

The frontend deliberately uses plain HTML, CSS, and JavaScript. There is no framework, bundler, or runtime dependency to configure.

## Development

Fake Cable requires Node.js 20 or newer only for running tests.

```bash
npm test
```

The test suite uses Node's built-in test runner. GitHub Actions runs it automatically for pushes to `main` and for pull requests.

For local browser development, serve the repository over HTTP rather than opening `index.html` directly. YouTube's embedded player requires a real web origin.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Use the repository root as the project root.
3. No build command is required.
4. No environment variables are required.
5. Deploy.

Commits to the connected branch redeploy automatically.

## How YouTube integration works

Fake Cable deliberately reads public YouTube pages and feeds instead of using the authenticated YouTube Data API. This keeps setup dramatically simpler, but it carries a tradeoff: YouTube can change those public response formats without notice.

The parser and scheduling logic are separated and tested to make repairs easier. Refresh failures preserve previously working programming rather than deleting the user's stations.

Shorts filtering is best-effort because YouTube does not expose a perfectly reliable unauthenticated public signal for every video.

## Browser storage and privacy

Station selections, cached channel data, unavailable-video history, and the last tuned channel are stored in the browser's local storage.

Clearing browser data removes that device's lineup. Use **Share Lineup** first if you want an easy way to restore it elsewhere.

Fake Cable does not require user accounts and does not maintain a central record of personal lineups.

## Third-party software

QR generation uses [QRCode.js](https://github.com/davidshimjs/qrcodejs), distributed under the MIT License. Its license text is included in `vendor/qrcode.LICENSE.txt`.

Phone pairing uses [PeerJS](https://peerjs.com/), distributed under the MIT License. Its license text is included in `vendor/peerjs.LICENSE.txt`. PeerJS provides signaling for the direct WebRTC connection; remote commands and television status travel between the paired browsers.

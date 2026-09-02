# Elsewhere Cable

A personal, fake-live cable system built from public YouTube channels.

## Deploying the update

Copy both of these into the root of the existing GitHub repository, preserving the folder structure:

```text
index.html
api/
  channels.js
```

Commit the files. Vercel will redeploy automatically. No packages, environment variables, Google Cloud project, API key, or account authorization are required.

## Creating your lineup

1. Open the deployed site and turn on the TV.
2. Select **Settings** on the on-screen remote.
3. Search for a creator by name and select **Add**, or paste any YouTube channel or video link into the search field.
4. Add up to 12 stations. Channels can be removed individually before building.
5. Select **Build My Channels**.

The app stores the resulting lineup and station list in that browser's local storage. Building a lineup may take roughly half a minute because the server reads each public feed and checks recent video durations.

This deliberately uses public YouTube pages and feeds instead of the official authenticated API. It is much easier to configure, but it may need repair if YouTube changes the structure of those public pages.

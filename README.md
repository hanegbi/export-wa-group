# WhatsApp Group Export

Chrome extension that exports the message history of a WhatsApp Web chat to a plain text file.

## Install (unpacked)

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

## Use

1. Open a chat on [web.whatsapp.com](https://web.whatsapp.com)
2. Click the extension icon
3. (Optional) Set a From and/or To date to limit the export to a range — leave blank for "now" / "full history"
4. Click **Export this group**
5. Download, copy, or delete the export from the list once it finishes

### How it knows it's done

WhatsApp loads older history in batches, and a batch can take a long time to arrive (longer still when it comes from your phone). The export therefore keeps scrolling up until the chat has produced nothing new for a full minute (three minutes while WhatsApp's "get older messages from your phone" prompt is showing), then saves. Expect every export to end with that one-minute pause — the popup shows a countdown. Press the stop button to finish early with what has been gathered so far.

Keep the WhatsApp tab visible while it runs. A hidden tab doesn't render, so WhatsApp can't load anything; the export waits rather than giving up, and the popup says so.

An export too large for the popup's list (roughly 10MB of text) is saved straight to your Downloads folder instead.

## Permissions

- `storage` — holds exports and export progress in `chrome.storage.session`, which clears itself on browser restart (that's the entire "reset every restart" behavior, no extra code needed).
- `downloads` — saves an export as a `.txt` file when you click Download.
- `activeTab` — lets the popup read the active tab's URL when you open it, to enable/disable the Export button.
- Content-script access to `web.whatsapp.com` — reads the open chat's messages on that page only; nothing is sent anywhere off your machine.

## Develop

```
npm test
```

## Project layout

- `src/content/` — scrapes and accumulates messages from the WhatsApp Web page
- `src/popup/` — the extension's popup UI
- `src/shared/` — pure helpers (formatting, timestamp parsing, storage state) used by both

import { serveTab } from '../shared/messages.js';
import { findOpenChat } from './chatPage.js';
import { exportChat } from './exportChat.js';

// The export in progress, or null. One at a time per tab.
let run = null;

serveTab({
  start(range, tabId) {
    if (run) return;
    const thisRun = { cancelled: false };
    run = thisRun;
    exportChat(range, tabId, () => thisRun.cancelled).finally(() => {
      run = null;
    });
  },
  cancel() {
    if (run) run.cancelled = true;
  },
  chatInfo() {
    const chat = findOpenChat();
    return { chatName: chat ? chat.name : null, running: Boolean(run) };
  },
});

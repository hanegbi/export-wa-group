// Both ends of the popup <-> WhatsApp tab conversation. The popup calls the
// request* functions; the content script answers them through serveTab.

const START = 'startExport';
const CANCEL = 'cancelExport';
const CHAT_INFO = 'chatInfo';

// `from` and `to` are datetime-local strings or null. The tab is told its
// own id because a content script has no other way to learn it.
export function requestStart(tabId, { from, to }) {
  return chrome.tabs.sendMessage(tabId, { action: START, from, to, tabId });
}

export function requestCancel(tabId) {
  return chrome.tabs.sendMessage(tabId, { action: CANCEL });
}

// Resolves to { chatName, running }. chatName is null when no chat is open.
export function requestChatInfo(tabId) {
  return chrome.tabs.sendMessage(tabId, { action: CHAT_INFO });
}

export function serveTab({ start, cancel, chatInfo }) {
  const handlers = {
    [START]: ({ from, to, tabId }) => start({ from, to }, tabId),
    [CANCEL]: () => cancel(),
    [CHAT_INFO]: () => chatInfo(),
  };
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = message && handlers[message.action];
    if (handler) sendResponse(handler(message) ?? {});
    return false;
  });
}

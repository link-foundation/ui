/* global chrome */
async function activateTab(tab) {
  if (!tab.id) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['devmode.js'],
    });
  } catch (error) {
    // Chrome's internal pages and other restricted targets cannot be inspected.
    console.warn('Links UI dev mode could not open:', error.message);
  }
}
chrome.action.onClicked.addListener(activateTab);

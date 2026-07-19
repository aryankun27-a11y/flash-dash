// Flash Dash - Background Service Worker (background.js)
// Handles cross-origin requests to bypass CORS limitations in extension pages.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchSuggestions') {
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(request.query)}`;
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Google API responded with status ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Flash Dash Service Worker Error:', error);
        sendResponse({ success: false, error: error.message });
      });
      
    return true; // Keep the message channel open for async sendResponse
  }
});

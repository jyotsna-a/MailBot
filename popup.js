document.getElementById('submitQuery').addEventListener('click', () => {
    const userQuery = document.getElementById('userQuery').value;
    chrome.runtime.sendMessage({ action: 'userQuery', query: userQuery }, function(response) {
      document.getElementById('results').textContent = response.summary;
    });
  });
  
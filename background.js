require('dotenv').config();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'userQuery') {
    handleUserQuery(message.query, sendResponse);
    return true;  // Keep the message channel open for sendResponse
  }
});

function handleUserQuery(query, sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, function(token) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    getChatGPTQuery(query).then(apiQuery => {
      fetchEmails(token, apiQuery, sendResponse);
    });
  });
}

function getChatGPTQuery(userQuery) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {role: 'system', content: 'You are an assistant that helps translate user questions into Gmail search queries.'},
        {role: 'user', content: userQuery}
      ]
    })
  })
  .then(response => response.json())
  .then(data => data.choices[0].message.content)
  .catch(error => console.error('Error fetching ChatGPT response:', error));
}

function fetchEmails(token, apiQuery, sendResponse) {
  fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(apiQuery)}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => response.json())
  .then(data => {
    const messages = data.messages || [];
    let emailContents = [];
    let fetchPromises = messages.map(message => 
      fetchEmailDetails(token, message.id).then(content => emailContents.push(content))
    );
    Promise.all(fetchPromises).then(() => {
      getChatGPTSummary(emailContents).then(summary => {
        sendResponse({ summary });
      });
    });
  })
  .catch(error => console.error('Error fetching emails:', error));
}

function fetchEmailDetails(token, messageId) {
  return fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => response.json())
  .then(data => {
    const email = {
      id: data.id,
      snippet: data.snippet,
      subject: data.payload.headers.find(header => header.name === 'Subject').value,
      from: data.payload.headers.find(header => header.name === 'From').value
    };
    return email;
  })
  .catch(error => console.error('Error fetching email details:', error));
}

function getChatGPTSummary(emailContents) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {role: 'system', content: 'You are an assistant that helps summarize email tasks.'},
        {role: 'user', content: 'Here are some email contents: ' + JSON.stringify(emailContents) + ' Can you summarize the tasks assigned?'}
      ]
    })
  })
  .then(response => response.json())
  .then(data => data.choices[0].message.content)
  .catch(error => console.error('Error fetching ChatGPT response:', error));
}

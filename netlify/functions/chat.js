// This runs on Netlify's server, not in the browser — so the API key
// never reaches the visitor's device or the page source.
// Uses Node's built-in https module (not fetch) so this works no matter
// which Node runtime version Netlify uses under the hood.
const https = require('https');

function callAnthropic(body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY ortam değişkeni ayarlanmamış.' } })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Geçersiz istek gövdesi' } }) };
  }

  const { messages, tools, model } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'messages dizisi gerekli' } }) };
  }

  const body = {
    model: model || 'claude-sonnet-5-5',
    max_tokens: 1500,
    messages
  };
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;

  try {
    const result = await callAnthropic(body, apiKey);
    return {
      statusCode: result.statusCode,
      headers: { 'content-type': 'application/json' },
      body: result.body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: { message: String(err && err.message ? err.message : err) } })
    };
  }
};


async function provider(path, opts = {}) {
  let response;

  try {
    response = await fetch(BASE + path, {
      ...opts,
      headers: {
        'x-client-id': process.env.PIX_CLIENT_ID,
        'x-client-secret': process.env.PIX_CLIENT_SECRET,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    console.error('provider_network_error', {
      message: error.message,
      name: error.name,
    });

    throw new Error('provider_network_error');
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.error('provider_error_details', {
      status: response.status,
      body: responseText.slice(0, 1500),
    });

    throw new Error('provider_error');
  }

  try {
    return JSON.parse(responseText);
  } catch (_) {
    console.error('provider_invalid_json', {
      status: response.status,
      body: responseText.slice(0, 500),
    });

    throw new Error('provider_invalid_json');
  }
}


const crypto = require('crypto');

const BASE = 'https://api.whitelabel-elite.com/v1';
const PROVIDER = 'whitelabel-elite';

const json = (res, code, data) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(data);
};

const uuid = value =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const configured = () =>
  process.env.PIX_ENABLED === 'true' &&
  !!(
    process.env.PIX_CLIENT_ID &&
    process.env.PIX_CLIENT_SECRET &&
    process.env.PIX_WEBHOOK_SECRET &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

const supaHeaders = (extra = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  ...extra,
});

// Supabase REST
async function db(table, query = '', opts = {}) {
  const url = new URL(
    '/rest/v1/' + table + query,
    process.env.SUPABASE_URL
  );

  const response = await fetch(url, {
    ...opts,
    headers: {
      ...supaHeaders(),
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const responseText = await response.text();

    console.error('db_error', {
      table,
      status: response.status,
      body: responseText.slice(0, 1000),
    });

    throw new Error('db_error');
  }

  const raw = await response.text();

  return raw ? JSON.parse(raw) : null;
}

// Whitelabel Elite
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
  } catch (error) {
    console.error('provider_invalid_json', {
      status: response.status,
      body: responseText.slice(0, 500),
    });

    throw new Error('provider_invalid_json');
  }
}

// Autenticação administrativa
async function requireAdmin(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token) {
    throw new Error('admin_unauthorized');
  }

  const response = await fetch(
    process.env.SUPABASE_URL + '/auth/v1/user',
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + token,
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error('admin_unauthorized');
  }

  const user = await response.json();

  if (!user || !uuid(user.id)) {
    throw new Error('admin_unauthorized');
  }

  const admins = await db(
    'admins',
    '?select=id&user_id=eq.' +
      encodeURIComponent(user.id) +
      '&limit=1'
  );

  if (!admins || !admins.length) {
    throw new Error('admin_forbidden');
  }

  return user;
}

// Validação HMAC SHA-256
function hmacOK(req) {
  const signature = String(
    req.headers['x-signature'] || ''
  ).replace(/^sha256=/i, '');

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  if (!Buffer.isBuffer(req.rawBodyBuffer)) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', process.env.PIX_WEBHOOK_SECRET || '')
    .update(req.rawBodyBuffer)
    .digest();

  const received = Buffer.from(signature, 'hex');

  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, expected);
}

function isPaid(status) {
  return String(status || '').toLowerCase() === 'paid';
}

function amountCents(value) {
  return Number.isFinite(Number(value))
    ? Math.round(Number(value) * 100)
    : NaN;
}

// Reconciliação segura do pagamento
async function reconcile(charge, tx) {
  const providerId = String(
    tx.transactionId || tx.id || ''
  );

  if (providerId !== charge.provider_charge_id) {
    return {
      accepted: false,
      reason: 'transaction_mismatch',
    };
  }

  if (
    amountCents(tx.amount) !==
    Number(charge.amount_cents)
  ) {
    return {
      accepted: false,
      reason: 'amount_mismatch',
    };
  }

  if (!isPaid(tx.status)) {
    return {
      accepted: false,
      reason: 'not_paid',
    };
  }

  const result = await db(
    'rpc/reaviva_confirm_pix',
    '',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_charge_id: charge.id,
        p_provider_id: providerId,
        p_amount_cents: charge.amount_cents,
      }),
    }
  );

  return {
    accepted: result === true,
    reason:
      result === true
        ? 'paid'
        : 'reconciliation_rejected',
  };
}

module.exports = {
  json,
  uuid,
  configured,
  db,
  provider,
  requireAdmin,
  hmacOK,
  reconcile,
  PROVIDER,
  amountCents,
};

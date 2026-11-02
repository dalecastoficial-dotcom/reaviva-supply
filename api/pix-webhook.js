
const crypto = require('crypto');

const {
  json,
  configured,
  db,
  provider,
  reconcile
} = require('./_pix-core');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, {
      error: 'method_not_allowed'
    });
  }

  if (!configured()) {
    return json(res, 503, {
      error: 'pix_disabled'
    });
  }

  const webhookSecret = process.env.PIX_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('pix_webhook_secret_missing');

    return json(res, 503, {
      error: 'webhook_not_configured'
    });
  }

  try {
    // Recebe o corpo original sem interpretação JSON automática
    const chunks = [];
    let length = 0;

    for await (const chunk of req) {
      length += chunk.length;

      if (length > 131072) {
        return json(res, 413, {
          error: 'payload_too_large'
        });
      }

      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks);

    if (!raw.length) {
      return json(res, 400, {
        error: 'empty_payload'
      });
    }

    // Valida a assinatura HMAC do corpo original
    const signature = String(
      req.headers['x-signature'] || ''
    )
      .trim()
      .replace(/^sha256=/i, '');

    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      return json(res, 401, {
        error: 'invalid_signature'
      });
    }

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(raw)
      .digest();

    const received = Buffer.from(signature, 'hex');

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return json(res, 401, {
        error: 'invalid_signature'
      });
    }

    // Interpreta o evento somente depois da validação
    let event;

    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      return json(res, 400, {
        error: 'invalid_json'
      });
    }

    // Identifica a transação informada pelo provedor
    const transactionId = String(
      event.transactionId || event.id || ''
    ).trim();

    if (
      !transactionId ||
      transactionId.length > 160
    ) {
      return json(res, 400, {
        error: 'missing_transaction_id'
      });
    }

    // Localiza a cobrança no banco
    const found = await db(
      'pix_charges',
      '?select=*' +
      '&provider_charge_id=eq.' +
      encodeURIComponent(transactionId) +
      '&limit=1'
    );

    if (!found || !found.length) {
      return json(res, 202, {
        ok: true,
        status: 'unknown_transaction'
      });
    }

    const charge = found[0];

    // Consulta o provedor: o webhook sozinho não confirma pagamento
    const transaction = await provider(
      '/transactions/' + encodeURIComponent(transactionId)
    );

    if (!transaction) {
      return json(res, 502, {
        error: 'provider_verification_failed'
      });
    }

    // Reconcilia cobrança e pedido no Supabase
    const result = await reconcile(
      charge,
      transaction
    );

    if (
      result &&
      (
        result.accepted === true ||
        result.reason === 'not_paid'
      )
    ) {
      return json(res, 200, {
        ok: true,
        verification: result.reason || 'accepted'
      });
    }

    console.error('pix_reconciliation_rejected', {
      transactionId,
      reason: result?.reason || 'unknown'
    });

    return json(res, 409, {
      error: result?.reason || 'reconciliation_failed'
    });

  } catch (error) {
    console.error(
      'pix_webhook_error',
      error.message
    );

    return json(res, 500, {
      error: 'webhook_processing_failed'
    });
  }
};

// Necessário para validar a assinatura usando o corpo original
handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;

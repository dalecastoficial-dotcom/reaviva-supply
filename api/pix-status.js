
const {
  json,
  uuid,
  configured,
  db,
  provider,
  requireAdmin,
  reconcile
} = require('./_pix-core');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!configured()) {
    return json(res, 503, { error: 'pix_disabled' });
  }

  try {
    // Exige autenticação de administrador
    if (!await requireAdmin(req)) {
      return json(res, 403, { error: 'admin_required' });
    }

    // Valida o ID do pedido
    const orderId = req.query.order_id;

    if (!uuid(orderId)) {
      return json(res, 400, { error: 'invalid_order_id' });
    }

    // Busca a cobrança mais recente do pedido
    const charges = await db(
      'pix_charges',
      '?select=*&order_id=eq.' +
      encodeURIComponent(orderId) +
      '&order=created_at.desc&limit=1'
    );

    if (!charges.length) {
      return json(res, 404, { error: 'charge_not_found' });
    }

    const charge = charges[0];

    // Se já foi confirmada, não consulta novamente
    if (charge.status === 'paid') {
      return json(res, 200, { status: 'paid' });
    }

    if (!charge.provider_charge_id) {
      return json(res, 409, {
        error: 'missing_provider_charge_id'
      });
    }

    // Consulta diretamente a Whitelabel Elite
    const tx = await provider(
      '/transactions/' +
      encodeURIComponent(charge.provider_charge_id)
    );

    // Confere ID, valor e status antes de confirmar
    const result = await reconcile(charge, tx);

    if (result.accepted) {
      return json(res, 200, {
        status: 'paid',
        verification: result.reason
      });
    }

    // Pagamento ainda não realizado
    if (result.reason === 'not_paid') {
      return json(res, 200, {
        status: 'pending',
        provider_status: tx.status || null
      });
    }

    // Divergência ou falha de validação
    console.error(
      'pix_status_verification_failed',
      result.reason
    );

    return json(res, 409, {
      error: 'payment_verification_failed',
      verification: result.reason
    });

  } catch (e) {
    console.error('pix_status_error', e.message);

    return json(res, 502, {
      error: 'status_check_failed'
    });
  }
};


const { json, configured, db } = require('./_pix-core');
const { verify } = require('./_checkout-token');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!configured()) {
    return json(res, 503, { error: 'pix_disabled' });
  }

  // Valida o token assinado do checkout
  const info = verify(req.query?.token);

  if (!info) {
    return json(res, 403, {
      error: 'invalid_or_expired_link'
    });
  }

  try {
    // Busca somente a cobrança vinculada ao token
    const charges = await db(
      'pix_charges',
      '?select=id,order_id,amount_cents,status,qr_code_text,qr_image_url' +
      '&order_id=eq.' + encodeURIComponent(info.o) +
      '&id=eq.' + encodeURIComponent(info.c) +
      '&limit=1'
    );

    const charge = charges?.[0];

    if (!charge) {
      return json(res, 404, {
        error: 'charge_not_found'
      });
    }

    // Busca o pedido correspondente
    const orders = await db(
      'orders',
      '?select=id,protocol,status,payment_status,total' +
      '&id=eq.' + encodeURIComponent(info.o) +
      '&limit=1'
    );

    const order = orders?.[0];

    if (!order) {
      return json(res, 404, {
        error: 'order_not_found'
      });
    }

    // Confere se cobrança e pedido possuem o mesmo valor
    const chargeAmount = Number(charge.amount_cents);
    const orderAmount = Math.round(Number(order.total) * 100);

    if (
      !Number.isFinite(chargeAmount) ||
      !Number.isFinite(orderAmount) ||
      chargeAmount <= 0 ||
      chargeAmount !== orderAmount
    ) {
      console.error('checkout_amount_mismatch', {
        orderId: order.id,
        chargeId: charge.id
      });

      return json(res, 409, {
        error: 'amount_mismatch'
      });
    }

    // Pagamento confirmado somente quando ambos os registros confirmam
    const paid =
      charge.status === 'paid' &&
      order.payment_status === 'pago';

    if (paid) {
      return json(res, 200, {
        protocol: order.protocol || null,
        amount: chargeAmount / 100,
        status: 'paid',
        qrCode: null
      });
    }

    // Cobranças que não estão pendentes não exibem QR Code
    if (charge.status !== 'pending') {
      return json(res, 200, {
        protocol: order.protocol || null,
        amount: chargeAmount / 100,
        status: 'unavailable',
        qrCode: null
      });
    }

    // Uma cobrança pendente precisa ter código Pix
    const copyPaste = String(charge.qr_code_text || '').trim();

    if (!copyPaste) {
      return json(res, 200, {
        protocol: order.protocol || null,
        amount: chargeAmount / 100,
        status: 'unavailable',
        qrCode: null
      });
    }

    // Aceita somente endereço HTTPS para a imagem do QR Code
    let imageUrl = null;

    try {
      const parsed = new URL(charge.qr_image_url || '');

      if (parsed.protocol === 'https:') {
        imageUrl = parsed.href;
      }
    } catch {
      imageUrl = null;
    }

    return json(res, 200, {
      protocol: order.protocol || null,
      amount: chargeAmount / 100,
      status: 'pending',
      qrCode: {
        copyPaste,
        imageUrl
      }
    });

  } catch (e) {
    console.error('checkout_query_failed', e.message);

    return json(res, 502, {
      error: 'checkout_unavailable'
    });
  }
};

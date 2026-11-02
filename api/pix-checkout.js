
const { json, configured, db } = require('./_pix-core');
const { verify } = require('./_checkout-token');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!configured()) {
    return json(res, 503, { error: 'pix_disabled' });
  }

  // Valida o token de acesso ao checkout
  const info = verify(req.query?.token);

  if (!info) {
    return json(res, 403, {
      error: 'invalid_or_expired_link'
    });
  }

  try {
    // Busca a cobrança vinculada ao token
    const charges = await db(
      'pix_charges',
      '?select=id,order_id,amount_cents,status,qr_code_text,qr_image_url' +
      '&order_id=eq.' + encodeURIComponent(info.o) +
      '&id=eq.' + encodeURIComponent(info.c) +
      '&limit=1'
    );

    const charge = charges?.[0];

    if (!charge) {
      return json(res, 404, { error: 'charge_not_found' });
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
      return json(res, 404, { error: 'order_not_found' });
    }

    // Confirmação exige os dois registros consistentes
    const paid =
      charge.status === 'paid' &&
      order.payment_status === 'pago';

    if (paid) {
      return json(res, 200, {
        protocol: order.protocol || null,
        amount: charge.amount_cents / 100,
        status: 'paid',
        qrCode: null
      });
    }

    // Somente cobranças pendentes exibem QR Code
    if (charge.status !== 'pending') {
      return json(res, 200, {
        protocol: order.protocol || null,
        amount: charge.amount_cents / 100,
        status: 'unavailable',
        qrCode: null
      });
    }

    // Aceita somente URLs HTTPS para a imagem
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
      amount: charge.amount_cents / 100,
      status: 'pending',
      qrCode: {
        copyPaste: charge.qr_code_text || '',
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


const { randomUUID } = require('crypto');

const {
  json,
  configured,
  db,
  provider,
  amountCents,
} = require('./_pix-core');

const { sign } = require('./_checkout-token');

const SHIPPING_BY_STATE = {
  ES: 1490,
  RJ: 1990,
  MG: 1990,
  SP: 2290,
  BA: 2690,
  DF: 2690,
  GO: 2690,
  PR: 2690,
  SC: 2690,
  RS: 2990,
  MS: 2990,
  MT: 2990,
  SE: 2990,
  AL: 2990,
  PE: 2990,
  AC: 3490,
  AM: 3490,
  AP: 3490,
  CE: 3490,
  MA: 3490,
  PA: 3490,
  PB: 3490,
  PI: 3490,
  RN: 3490,
  RO: 3490,
  RR: 3490,
  TO: 3490,
};

const MAX_QUANTITY = 10;

function clean(value, maxLength = 200) {
  return String(value || '').trim().slice(0, maxLength);
}

function validUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function money(cents) {
  return Number((cents / 100).toFixed(2));
}

function normalizeOptions(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim());
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim());
      }
    } catch (_) {
      return value.split(',').map(item => item.trim());
    }
  }

  return [];
}

async function lookupCEP(cep) {
  const response = await fetch(
    `https://viacep.com.br/ws/${cep}/json/`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error('cep_service_unavailable');
  }

  const data = await response.json();

  if (data.erro || !data.uf) {
    throw new Error('invalid_cep');
  }

  return data;
}

function calculateShipping(state, quantity) {
  const baseCents = SHIPPING_BY_STATE[state];

  if (!baseCents) {
    throw new Error('shipping_state_unavailable');
  }

  return Math.round(baseCents * (1 + 0.5 * (quantity - 1)));
}

function generateProtocol() {
  const year = new Date().getFullYear();
  const random = randomUUID()
    .replace(/-/g, '')
    .slice(0, 8)
    .toUpperCase();

  return `REA-${year}-${random}`;
}

function errorResponse(res, status, message) {
  return json(res, status, { error: message });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return errorResponse(res, 405, 'method_not_allowed');
  }

  if (!configured()) {
    return errorResponse(res, 503, 'pix_not_configured');
  }

  try {
    const signingSecret = process.env.CHECKOUT_TOKEN_SECRET;

    if (!signingSecret || signingSecret.length < 32) {
      throw new Error('checkout_signing_secret_not_configured');
    }

    const body = req.body || {};

    // Aceita os nomes reais enviados pelo formulário público.
    const customerName = clean(
      body.customer_name || body.name,
      120
    );

    const customerPhone = clean(
      body.customer_phone || body.phone,
      30
    );

    const customerEmail = clean(
      body.customer_email || body.email,
      160
    ).toLowerCase();

    const cep = clean(body.cep, 9).replace(/\D/g, '');
    const street = clean(body.street, 160);
    const number = clean(body.number, 30);
    const complement = clean(body.complement, 100);
    const neighborhood = clean(body.neighborhood, 100);
    const city = clean(body.city, 100);
    const state = clean(body.state, 2).toUpperCase();

    const productId = clean(
      body.product_id || body.productId,
      50
    );

    const size = clean(body.size, 20);
    const color = clean(body.color, 40);
    const quantity = Number(body.quantity);

    // Checkbox HTML pode chegar como "on" ou true.
    const consent =
      body.consent === true ||
      body.privacyConsent === true ||
      body.customer_agreed === true ||
      body.privacy_agreed === true ||
      body.privacy_agreed === 'on' ||
      body.privacy_agreed === 'true';

    // Campo invisível antispam.
    if (clean(body.website, 200)) {
      return errorResponse(res, 400, 'invalid_request');
    }

    if (customerName.length < 3) {
      return errorResponse(res, 400, 'invalid_customer_name');
    }

    if (customerPhone.replace(/\D/g, '').length < 10) {
      return errorResponse(res, 400, 'invalid_customer_phone');
    }

    if (
      customerEmail &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)
    ) {
      return errorResponse(res, 400, 'invalid_customer_email');
    }

    if (!/^\d{8}$/.test(cep)) {
      return errorResponse(res, 400, 'invalid_cep');
    }

    if (
      !street ||
      !number ||
      !neighborhood ||
      !city ||
      !/^[A-Z]{2}$/.test(state)
    ) {
      return errorResponse(res, 400, 'incomplete_delivery_address');
    }

    if (!validUUID(productId)) {
      return errorResponse(res, 400, 'invalid_product');
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return errorResponse(res, 400, 'invalid_quantity');
    }

    if (!size || !color) {
      return errorResponse(res, 400, 'size_and_color_required');
    }

    if (!consent) {
      return errorResponse(res, 400, 'privacy_consent_required');
    }

    // Valida CEP no servidor.
    const cepData = await lookupCEP(cep);

    if (cepData.uf !== state) {
      return errorResponse(res, 400, 'cep_state_mismatch');
    }

    // Consulta produto no banco.
    const products = await db(
      'products',
      '?select=*&id=eq.' +
        encodeURIComponent(productId) +
        '&limit=1'
    );

    if (!products || !products.length) {
      return errorResponse(res, 404, 'product_not_found');
    }

    const product = products[0];

    if (
      product.active === false ||
      product.is_active === false
    ) {
      return errorResponse(res, 400, 'product_unavailable');
    }

    const availableSizes = normalizeOptions(
      product.sizes || product.available_sizes
    );

    const availableColors = normalizeOptions(
      product.colors || product.available_colors
    );

    if (
      availableSizes.length &&
      !availableSizes.some(
        item => item.toLowerCase() === size.toLowerCase()
      )
    ) {
      return errorResponse(res, 400, 'invalid_product_size');
    }

    if (
      availableColors.length &&
      !availableColors.some(
        item => item.toLowerCase() === color.toLowerCase()
      )
    ) {
      return errorResponse(res, 400, 'invalid_product_color');
    }

    // O preço é sempre obtido do banco, nunca do navegador.
    const productPrice = Number(product.price);

    if (!Number.isFinite(productPrice) || productPrice <= 0) {
      throw new Error('invalid_product_price');
    }

    const unitPriceCents = amountCents(productPrice);

    if (
      !Number.isSafeInteger(unitPriceCents) ||
      unitPriceCents <= 0
    ) {
      throw new Error('invalid_product_price');
    }

    // Calcula os valores em centavos.
    const subtotalCents = unitPriceCents * quantity;
    const shippingCents = calculateShipping(state, quantity);
    const totalCents = subtotalCents + shippingCents;

    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      throw new Error('invalid_order_total');
    }

    const subtotal = money(subtotalCents);
    const shipping_cost = money(shippingCents);
    const total = money(totalCents);

    const protocol = generateProtocol();
    const productName = clean(
      product.name || product.title,
      160
    );

    if (!productName) {
      throw new Error('product_name_missing');
    }

    // 1. Registra o pedido.
    const insertedOrders = await db(
      'orders',
      '?select=id,protocol',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          protocol,
          product_id: productId,
          product_name: productName,
          size,
          color,
          quantity,

          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,

          cep,
          street,
          number,
          complement: complement || null,
          neighborhood,
          city: cepData.localidade || city,
          state: cepData.uf,

          subtotal,
          shipping_cost,
          total,

          status: 'solicitado',
          payment_method: 'pix',
          payment_status: 'aguardando_pagamento',
          customer_agreed: true,
        }),
      }
    );

    if (!insertedOrders || !insertedOrders.length) {
      throw new Error('order_insert_failed');
    }

    const order = insertedOrders[0];

    // 2. Solicita Pix à Whitelabel Elite.
    const pix = await provider('/deposit', {
      method: 'POST',
      body: JSON.stringify({
        amount: total,
        description: `Pedido REAVIVA ${protocol}`,
      }),
    });

    const providerChargeId = clean(
      pix.transactionId || pix.acquirerTransactionId,
      160
    );

    const copyPaste = clean(
      pix.qrCode?.copyPaste,
      5000
    );

    const imageUrl = clean(
      pix.qrCode?.imageUrl,
      1000
    );

    if (!providerChargeId || !copyPaste) {
      throw new Error('provider_invalid_pix_response');
    }

    // 3. Registra cobrança Pix.
    const charges = await db(
      'pix_charges',
      '?select=id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          order_id: order.id,
          provider: 'whitelabel-elite',
          provider_charge_id: providerChargeId,
          amount_cents: totalCents,
          currency: 'BRL',
          status: 'pending',
          qr_code_text: copyPaste,
          qr_image_url: imageUrl || null,
        }),
      }
    );

    if (!charges || !charges.length) {
      throw new Error('pix_charge_insert_failed');
    }

    const charge = charges[0];

    // 4. Vincula transação ao pedido.
    await db(
      'orders',
      '?id=eq.' + encodeURIComponent(order.id),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_external_id: providerChargeId,
        }),
      }
    );

    // 5. Gera token assinado para a página de pagamento.
    const token = sign(order.id, charge.id);

    return json(res, 200, {
      success: true,
      protocol,
      subtotal,
      shippingCost: shipping_cost,
      amount: total,
      checkoutPath:
        '/pagamento.html?token=' +
        encodeURIComponent(token),
    });

  } catch (error) {
    console.error(
      'public_pix_checkout_error',
      error && error.message
        ? error.message
        : 'unknown_error'
    );

    return errorResponse(
      res,
      500,
      'Não foi possível gerar o Pix. Se houve registro do pedido, entre em contato com a loja antes de tentar novamente.'
    );
  }
};

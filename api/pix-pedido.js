// Checkout público REAVIVA SUPPLY
// Preço e frete são calculados no servidor.
// Nunca aceita total ou confirmação de pagamento enviados pelo navegador.

const { randomUUID } = require('crypto');
const {
  json,
  configured,
  db,
  provider,
  PROVIDER,
  amountCents
} = require('./_pix-core');

const { sign } = require('./_checkout-token');

const clean = (v, n = 120) =>
  String(v ?? '').trim().slice(0, n);

const validUUID = s =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Frete comercial fixo por UF.
// Não representa cotação oficial dos Correios.
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
  TO: 3490
};

async function lookupCEP(cep) {
  const response = await fetch(
    `https://viacep.com.br/ws/${cep}/json/`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error('cep_lookup_failed');
  }

  const data = await response.json();

  if (data.erro || !data.uf || !data.localidade) {
    throw new Error('invalid_cep');
  }

  return data;
}

function calculateShipping(state, quantity) {
  const baseCents = SHIPPING_BY_STATE[state];

  if (!Number.isInteger(baseCents)) {
    throw new Error('shipping_state_unavailable');
  }

  // 1 unidade = 100% do frete
  // Cada unidade adicional acrescenta 50% da tarifa-base.
  const shippingCents = baseCents * (quantity + 1) / 2;

  if (!Number.isSafeInteger(shippingCents)) {
    throw new Error('invalid_shipping_amount');
  }

  return shippingCents;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!configured()) {
    return json(res, 503, { error: 'pix_disabled' });
  }

  if ((process.env.PIX_CHECKOUT_SIGNING_KEY || '').length < 32) {
    return json(res, 503, {
      error: 'checkout_signing_key_missing'
    });
  }

  try {
    let d = req.body;

    if (typeof d === 'string') {
      d = JSON.parse(d);
    }

    if (!d || typeof d !== 'object') {
      return json(res, 400, { error: 'invalid_request' });
    }

    // Campo invisível antispam.
    if (d.website) {
      return json(res, 200, { status: 'received' });
    }

    const productId = clean(d.product_id, 40);
    const name = clean(d.customer_name);
    const phone = clean(d.customer_phone, 25).replace(/\D/g, '');
    const email = clean(d.customer_email, 150);
    const cep = clean(d.cep, 12).replace(/\D/g, '');

    const size = clean(d.size, 30);
    const color = clean(d.color, 50);
    const quantity = Number(d.quantity);

    const street = clean(d.street, 140);
    const number = clean(d.number, 15);
    const complement = clean(d.complement, 100);
    const neighborhood = clean(d.neighborhood, 100);
    const submittedCity = clean(d.city, 100);
    const submittedState = clean(d.state, 2).toUpperCase();
    const notes = clean(d.customer_notes, 500);

    if (
      !validUUID(productId) ||
      name.length < 2 ||
      !/^(?:55)?\d{10,11}$/.test(phone) ||
      !/^\d{8}$/.test(cep) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10 ||
      !street ||
      !number ||
      !neighborhood ||
      !submittedCity ||
      !/^[A-Z]{2}$/.test(submittedState) ||
      d.privacy_agreed !== true ||
      (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    ) {
      return json(res, 400, {
        error: 'Confira os campos e aceite o tratamento de dados.'
      });
    }

    // Consulta confiável do CEP: UF e município não são definidos
    // exclusivamente pelo que o navegador enviou.
    let cepData;

    try {
      cepData = await lookupCEP(cep);
    } catch (error) {
      if (error.message === 'invalid_cep') {
        return json(res, 400, {
          error: 'CEP inválido. Confira o endereço informado.'
        });
      }

      return json(res, 503, {
        error: 'Não foi possível consultar o CEP agora. Tente novamente.'
      });
    }

    const state = String(cepData.uf).toUpperCase();
    const city = String(cepData.localidade);

    if (submittedState !== state) {
      return json(res, 400, {
        error: `A UF informada não corresponde ao CEP. Para esse CEP, selecione ${state}.`
      });
    }

    // Busca o produto ativo diretamente no catálogo.
    const products = await db(
      'products',
      '?select=id,name,price,sizes,colors,active&id=eq.' +
        productId +
        '&active=eq.true&limit=1'
    );

    const product = products?.[0];

    if (!product) {
      return json(res, 404, {
        error: 'Produto indisponível.'
      });
    }

    if (
      !product.sizes?.includes(size) ||
      !product.colors?.includes(color)
    ) {
      return json(res, 400, {
        error: 'Tamanho ou cor inválidos para este produto.'
      });
    }

    const unitPrice = Number(product.price);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return json(res, 409, {
        error: 'Preço do produto não configurado.'
      });
    }

    // Valores em centavos para evitar erros de arredondamento.
    const subtotalCents = amountCents(unitPrice * quantity);

    if (
      !Number.isSafeInteger(subtotalCents) ||
      subtotalCents < 100
    ) {
      return json(res, 409, {
        error: 'Valor do produto inválido.'
      });
    }

    const shippingCents = calculateShipping(state, quantity);
    const totalCents = subtotalCents + shippingCents;

    if (!Number.isSafeInteger(totalCents) || totalCents < 100) {
      return json(res, 409, {
        error: 'Valor total inválido.'
      });
    }

    const subtotal = subtotalCents / 100;
    const shippingCost = shippingCents / 100;
    const total = totalCents / 100;

    const protocol =
      'RV-' + randomUUID().split('-')[0].toUpperCase();

    // O total salvo no pedido deve ser igual ao valor da cobrança Pix,
    // pois a rotina de confirmação compara esses valores.
    const order = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,

      product_name: product.name,
      product_id: product.id,
      size,
      color,
      quantity,

      subtotal,
      shipping_cost,
      total,

      status: 'solicitado',
      customer_agreed: true,

      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,

      customer_notes: notes,

      payment_method: 'pix',
      payment_status: 'aguardando_pagamento',
      protocol,

      notes:
        'Pedido pelo checkout público REAVIVA SUPPLY. ' +
        'Subtotal: R$ ' + subtotal.toFixed(2) +
        '. Frete: R$ ' + shippingCost.toFixed(2) +
        '. Total: R$ ' + total.toFixed(2) +
        '. Disponibilidade sujeita à confirmação da loja.'
    };

    const created = await db(
      'orders',
      '?select=id,protocol,total',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(order)
      }
    );

    const saved = created?.[0];

    if (!saved?.id) {
      throw new Error('order_insert_failed');
    }

    // Emite Pix pelo valor integral: produtos + frete.
    const tx = await provider('/deposit', {
      method: 'POST',
      body: JSON.stringify({
        amount: total,
        description: 'REAVIVA ' + protocol
      })
    });

    const providerId = String(tx.transactionId || '');
    const qr = tx.qrCode || {};

    if (!providerId || !qr.copyPaste) {
      throw new Error('provider_contract_incomplete');
    }

    const inserted = await db(
      'pix_charges',
      '?select=id,provider_charge_id,amount_cents,status',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          order_id: saved.id,
          provider: PROVIDER,
          provider_charge_id: providerId,
          amount_cents: totalCents,
          status: 'pending',
          qr_code_text: qr.copyPaste,
          qr_image_url: qr.imageUrl || null
        })
      }
    );

    const charge = inserted?.[0];

    if (!charge?.id) {
      throw new Error('charge_insert_failed');
    }

    await db(
      'orders',
      '?id=eq.' + saved.id,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_status: 'aguardando_pagamento',
          payment_external_id: providerId
        })
      }
    );

    return json(res, 201, {
      protocol,
      checkoutPath:
        '/pagamento.html?token=' +
        encodeURIComponent(sign(saved.id, charge.id)),
      subtotal,
      shippingCost,
      amount: total
    });

  } catch (error) {
    console.error(
      'public_pix_checkout_error',
      error.message
    );

    return json(res, 502, {
      error:
        'Não foi possível gerar o Pix. Se houve registro do pedido, entre em contato com a loja antes de tentar novamente.'
    });
  }
};

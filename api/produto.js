
const {
  origin,
  live,
  escapeHtml: e,
  safeImage,
  products,
  sendHtml,
  productPath
} = require('./_seo');

const SHIPPING_BY_STATE = {
  ES: 1490,
  RJ: 1990, MG: 1990,
  SP: 2290,
  BA: 2690, DF: 2690, GO: 2690, PR: 2690, SC: 2690,
  RS: 2990, MS: 2990, MT: 2990, SE: 2990, AL: 2990, PE: 2990,
  AC: 3490, AM: 3490, AP: 3490, CE: 3490, MA: 3490,
  PA: 3490, PB: 3490, PI: 3490, RN: 3490, RO: 3490,
  RR: 3490, TO: 3490
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const identifier = String(req.query.slug || req.query.id || '').trim();

  const match = identifier.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );

  if (!match) {
    return res.status(404).send('Produto não encontrado');
  }

  const id = match[1];

  let p;

  try {
    p = (await products()).find(x => x.id === id);
  } catch {
    return res.status(503).send('Catálogo temporariamente indisponível');
  }

  if (!p) {
    return res.status(404).send('Produto não encontrado');
  }

  const expectedPath = productPath(p);

  if (identifier !== id && '/produto/' + identifier !== expectedPath) {
    return res.status(404).send('Produto não encontrado');
  }

  if (identifier === id) {
    res.setHeader('Location', expectedPath);
    return res.status(301).end();
  }

  const base = origin();
  const title = `${p.name} | Camiseta cristã | REAVIVA SUPPLY`;

  const description =
    `${p.name}: ${p.type || 'camiseta'} ${p.category || 'unissex'} de moda cristã. Confira tamanhos, cores e condições de compra na REAVIVA SUPPLY.`;

  const image = safeImage(p.image_url);
  const link = `${base}${expectedPath}`;
  const shouldIndex = live() && !!image && p.price != null;

  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description,
    sku: p.id,
    brand: {
      '@type': 'Brand',
      name: 'REAVIVA SUPPLY — loja multimarcas'
    },
    url: link,
    ...(image ? { image: [image] } : {})
  };

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${shouldIndex ? 'index,follow' : 'noindex,follow'}">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(link)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
${image ? `<meta property="og:image" content="${e(image)}">` : ''}
<meta property="og:url" content="${e(link)}">
<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>

<style>
:root{
  color-scheme:light;
  --ink:#171717;
  --muted:#716b64;
  --line:#e8e2da;
  --paper:#f8f6f2;
  --gold:#b58a55
}

*{box-sizing:border-box}

body{
  margin:0;
  background:var(--paper);
  color:var(--ink);
  font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif
}

header,footer{
  background:#151515;
  color:#fff;
  padding:14px max(18px,calc((100vw - 1120px)/2))
}

header a,footer a{
  color:#ead5b9;
  text-decoration:none;
  font-size:13px;
  font-weight:600
}

main{
  max-width:1120px;
  margin:auto;
  padding:28px 22px 40px;
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(390px,.92fr);
  gap:34px;
  align-items:start
}

.product-visual{position:sticky;top:18px}

.product-visual img{
  display:block;
  width:100%;
  max-height:620px;
  object-fit:cover;
  border-radius:12px;
  background:#eee
}

.product-info>small{
  color:var(--gold);
  font-size:11px;
  font-weight:800;
  letter-spacing:.12em;
  text-transform:uppercase
}

h1{
  font-size:clamp(27px,3.4vw,42px);
  line-height:1.08;
  letter-spacing:-.035em;
  margin:9px 0 10px
}

.description{
  color:var(--muted);
  font-size:14px;
  margin:0 0 12px
}

.price{font-size:20px;margin:12px 0 4px}

.availability{
  font-size:11px;
  color:var(--muted);
  margin:0 0 14px
}

.details{
  font-size:12px;
  color:var(--muted);
  margin:0 0 14px
}

.purchase-form{
  display:grid;
  gap:10px;
  background:#fff;
  border:1px solid var(--line);
  padding:17px;
  border-radius:12px;
  box-shadow:0 8px 24px #24180d0a;
  margin:0
}

.form-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px
}

.form-head h2{
  font-size:18px;
  letter-spacing:-.02em;
  margin:0
}

.secure-note{
  font-size:11px;
  color:var(--muted);
  margin:-4px 0 2px
}

.form-section{
  font-size:10px;
  font-weight:800;
  letter-spacing:.1em;
  text-transform:uppercase;
  color:#8c765d;
  margin:3px 0 -4px
}

.purchase-form label{
  display:grid;
  gap:4px;
  font-size:11px;
  font-weight:650;
  color:#514b45;
  min-width:0
}

.purchase-form input,
.purchase-form select,
.purchase-form textarea{
  font:inherit;
  font-size:13px;
  padding:9px 10px;
  border:1px solid #ded8d0;
  border-radius:7px;
  width:100%;
  min-width:0;
  background:#fff;
  color:var(--ink);
  min-height:38px;
  outline:none
}

.purchase-form input:focus,
.purchase-form select:focus,
.purchase-form textarea:focus{
  border-color:var(--gold);
  box-shadow:0 0 0 3px #b58a551c
}

.purchase-form .fields{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:9px
}

.purchase-form .fields.three{
  grid-template-columns:1.1fr 1.1fr .7fr
}

.purchase-form .consent{
  display:flex;
  align-items:flex-start;
  gap:8px;
  font-size:10px;
  font-weight:450;
  line-height:1.35;
  color:var(--muted)
}

.purchase-form .consent input{
  width:15px;
  min-height:15px;
  height:15px;
  margin:1px 0 0;
  flex:0 0 15px
}

.purchase-form button{
  background:#171717;
  color:white;
  border:0;
  border-radius:8px;
  padding:13px 16px;
  font-size:13px;
  font-weight:800;
  letter-spacing:.04em;
  cursor:pointer;
  min-height:46px
}

.purchase-form button:disabled{
  opacity:.55;
  cursor:wait
}

.button-sub{
  font-size:10px;
  color:#aaa;
  text-align:center;
  margin:-5px 0 0
}

.trap{
  position:absolute;
  left:-10000px
}

#orderResult{
  font-size:12px;
  font-weight:650;
  margin:0;
  min-height:0;
  color:#9a3e2f
}

.shipping-summary{
  background:#f8f6f2;
  border:1px solid var(--line);
  border-radius:9px;
  padding:13px;
  font-size:12px
}

.shipping-line{
  display:flex;
  justify-content:space-between;
  gap:12px;
  margin-bottom:7px
}

.shipping-total{
  display:flex;
  justify-content:space-between;
  gap:12px;
  border-top:1px solid var(--line);
  padding-top:9px;
  font-size:15px
}

.shipping-message{
  font-size:10px;
  color:var(--muted);
  margin:8px 0 0
}

@media(max-width:760px){
  main{
    grid-template-columns:1fr;
    padding:14px 14px 28px;
    gap:14px
  }

  .product-visual{position:static}

  .product-visual img{
    max-height:280px;
    object-fit:contain;
    background:#f0ece6
  }

  .product-info>small{font-size:10px}
  h1{font-size:29px;margin:6px 0}
  .description{font-size:13px;margin-bottom:7px}
  .price{font-size:18px;margin:7px 0 2px}
  .availability,.details{font-size:10px;margin-bottom:9px}

  .purchase-form{
    padding:13px;
    gap:8px
  }

  .form-head h2{font-size:17px}

  .purchase-form input,
  .purchase-form select{
    min-height:37px;
    padding:8px 9px
  }

  .purchase-form .fields{gap:7px}

  .purchase-form button{
    position:sticky;
    bottom:8px;
    box-shadow:0 5px 18px #0002
  }
}

@media(max-width:360px){
  .purchase-form .fields.three{
    grid-template-columns:1fr 1fr
  }

  .purchase-form .fields.three label:last-child{
    grid-column:1/-1
  }
}
</style>
</head>

<body>
<header>
  <a href="/">← REAVIVA SUPPLY</a>
</header>

<main>
  <div class="product-visual">
    ${image ? `<img src="${e(image)}" alt="${e(p.name)}" loading="eager">` : ''}
  </div>

  <section class="product-info">
    <small>MODA CRISTÃ · ${e(p.category || '')}</small>

    <h1>${e(p.name)}</h1>

    <p class="description">${e(description)}</p>

    <p class="price">
      <strong>
        ${p.price == null
          ? 'Preço sob consulta'
          : 'R$ ' + Number(p.price).toFixed(2).replace('.', ',')}
      </strong>
    </p>

    <p class="availability">
      Disponibilidade sujeita à confirmação da loja. O envio acontece após confirmação da disponibilidade e do pagamento.
    </p>

    <p class="details">
      ${e(p.type || 'Modelagem a consultar')}
      · Tamanhos: ${e(sizes.join(', ') || 'Consultar')}
      · Cores: ${e(colors.join(', ') || 'Consultar')}
    </p>

    <form id="checkoutForm" class="purchase-form">
      <div class="form-head">
        <h2>Finalizar pedido</h2>
        <small>PIX</small>
      </div>

      <p class="secure-note">
        Informe seus dados para calcular o frete e gerar seu Pix.
      </p>

      <p class="form-section">Seus dados</p>

      <label>
        Nome completo
        <input name="customer_name" autocomplete="name" required maxlength="120" placeholder="Como podemos chamar você?">
      </label>

      <div class="fields">
        <label>
          WhatsApp com DDD
          <input name="customer_phone" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="(27) 99999-9999">
        </label>

        <label>
          E-mail <span style="font-weight:400;color:#888">(opcional)</span>
          <input name="customer_email" type="email" autocomplete="email" maxlength="150" placeholder="voce@email.com">
        </label>
      </div>

      <p class="form-section">Escolha da peça</p>

      <div class="fields three">
        <label>
          Tamanho
          <select name="size" required>
            <option value="">Escolher</option>
            ${sizes.filter(x => String(x).toLowerCase() !== 'consultar').map(x =>
              `<option value="${e(x)}">${e(x)}</option>`
            ).join('')}
          </select>
        </label>

        <label>
          Cor
          <select name="color" required>
            <option value="">Escolher</option>
            ${colors.filter(x => String(x).toLowerCase() !== 'consultar').map(x =>
              `<option value="${e(x)}">${e(x)}</option>`
            ).join('')}
          </select>
        </label>

        <label>
          Qtd.
          <input name="quantity" type="number" min="1" max="10" value="1" required>
        </label>
      </div>

      <p class="form-section">Endereço de entrega</p>

      <div class="fields">
        <label>
          CEP
          <input name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" required placeholder="00000-000">
        </label>

        <label>
          Rua / avenida
          <input name="street" autocomplete="address-line1" required maxlength="140" placeholder="Nome da rua">
        </label>
      </div>

      <div class="fields three">
        <label>
          Número
          <input name="number" required maxlength="15" placeholder="Nº">
        </label>

        <label>
          Complemento <span style="font-weight:400;color:#888">(opcional)</span>
          <input name="complement" maxlength="100" placeholder="Apto, bloco...">
        </label>

        <label>
          Bairro
          <input name="neighborhood" autocomplete="address-level3" required maxlength="100">
        </label>
      </div>

      <div class="fields">
        <label>
          Cidade
          <input name="city" autocomplete="address-level2" required maxlength="100">
        </label>

        <label>
          UF
          <input name="state" autocomplete="address-level1" required maxlength="2" minlength="2" placeholder="ES">
        </label>
      </div>

      <div class="shipping-summary">
        <div class="shipping-line">
          <span>Subtotal dos produtos</span>
          <strong id="subtotalPreview">—</strong>
        </div>

        <div class="shipping-line">
          <span>Frete</span>
          <strong id="shippingPreview">Informe seu CEP</strong>
        </div>

        <div class="shipping-total">
          <strong>Total do pedido</strong>
          <strong id="totalPreview">—</strong>
        </div>

        <p id="shippingMessage" class="shipping-message">
          O frete será calculado conforme o CEP e a quantidade.
        </p>
      </div>

      <label class="consent">
        <input name="privacy_agreed" type="checkbox" required>
        Concordo com o uso dos meus dados para processar o pedido, entrar em contato e realizar a entrega.
      </label>

      <div class="trap" aria-hidden="true">
        <label>
          Site
          <input name="website" tabindex="-1" autocomplete="off">
        </label>
      </div>

      <button type="submit">
        GERAR PIX E PAGAR
      </button>

      <p class="button-sub">
        Você verá o QR Code e o código Pix na próxima etapa.
      </p>

      <p id="orderResult" role="status" aria-live="polite"></p>
    </form>

    <script>
    (() => {
      const f = document.getElementById('checkoutForm');
      const $ = id => document.getElementById(id);

      const productId = ${JSON.stringify(id)};
      const unitPrice = ${JSON.stringify(Number(p.price) || 0)};

      const shippingByState = ${JSON.stringify(SHIPPING_BY_STATE)};

      const money = cents => (cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      let cepRequest = 0;
      let cepValid = false;
      let validatedCep = '';

      const quantityInput = f.elements.quantity;
      const cepInput = f.elements.cep;
      const stateInput = f.elements.state;
      const cityInput = f.elements.city;

      function updateEstimate() {
        const quantity = Number(quantityInput.value);
        const state = stateInput.value.trim().toUpperCase();

        const validQuantity =
          Number.isInteger(quantity) && quantity >= 1 && quantity <= 10;

        const subtotalCents =
          Math.round(unitPrice * 100) * (validQuantity ? quantity : 0);

        $('subtotalPreview').textContent =
          validQuantity && unitPrice > 0 ? money(subtotalCents) : '—';

        if (
          !cepValid ||
          validatedCep !== cepInput.value.replace(/\\D/g, '') ||
          !shippingByState[state] ||
          !validQuantity ||
          unitPrice <= 0
        ) {
          $('shippingPreview').textContent = 'Informe um CEP válido';
          $('totalPreview').textContent = '—';
          return;
        }

        const shippingCents =
          shippingByState[state] * (quantity + 1) / 2;

        const totalCents = subtotalCents + shippingCents;

        $('shippingPreview').textContent = money(shippingCents);
        $('totalPreview').textContent = money(totalCents);

        $('shippingMessage').textContent =
          'Frete estimado para ' + state +
          '. O valor definitivo será validado ao gerar o Pix.';
      }

      async function lookupCEP() {
        const cep = cepInput.value.replace(/\\D/g, '');
        const requestId = ++cepRequest;

        cepValid = false;
        validatedCep = '';
        updateEstimate();

        if (cep.length !== 8) {
          $('shippingMessage').textContent =
            'Digite um CEP com 8 números.';
          return;
        }

        $('shippingMessage').textContent = 'Consultando CEP...';

        try {
          const response = await fetch(
            'https://viacep.com.br/ws/' + cep + '/json/'
          );

          if (!response.ok) {
            throw new Error('cep_lookup_failed');
          }

          const data = await response.json();

          if (requestId !== cepRequest) return;
          if (data.erro || !data.uf || !data.localidade) {
            throw new Error('invalid_cep');
          }

          stateInput.value = data.uf;
          cityInput.value = data.localidade;

          if (data.logradouro && !f.elements.street.value.trim()) {
            f.elements.street.value = data.logradouro;
          }

          if (data.bairro && !f.elements.neighborhood.value.trim()) {
            f.elements.neighborhood.value = data.bairro;
          }

          cepValid = true;
          validatedCep = cep;

          $('shippingMessage').textContent =
            'CEP localizado: ' + data.localidade + ' - ' + data.uf;

          updateEstimate();

        } catch {
          if (requestId !== cepRequest) return;

          cepValid = false;
          validatedCep = '';

          $('shippingMessage').textContent =
            'Não foi possível validar o CEP. Confira e tente novamente.';

          updateEstimate();
        }
      }

      cepInput.addEventListener('blur', lookupCEP);

      cepInput.addEventListener('input', () => {
        cepValid = false;
        validatedCep = '';
        updateEstimate();
      });

      quantityInput.addEventListener('input', updateEstimate);

      f.addEventListener('submit', async event => {
        event.preventDefault();

        const button = f.querySelector('button[type="submit"]');
        const message = $('orderResult');

        if (!cepValid || validatedCep !== cepInput.value.replace(/\\D/g, '')) {
          message.textContent =
            'Informe e valide seu CEP antes de continuar.';
          cepInput.focus();
          return;
        }

        if (unitPrice <= 0) {
          message.textContent =
            'Este produto está temporariamente sem preço configurado.';
          return;
        }

        button.disabled = true;
        message.textContent = 'Registrando pedido e gerando Pix...';

        try {
          const payload = Object.fromEntries(new FormData(f));

          payload.product_id = productId;
          payload.quantity = Number(payload.quantity);
          payload.privacy_agreed = !!payload.privacy_agreed;

          const response = await fetch('/api/pix-pedido', {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Não foi possível gerar o Pix.');
          }

          if (!data.checkoutPath) {
            throw new Error('Link de pagamento não retornado.');
          }

          location.href = data.checkoutPath;

        } catch (error) {
          message.textContent = error.message;
          button.disabled = false;
        }
      });

      updateEstimate();
    })();
    </script>
  </section>
</main>

<footer>
  <a href="/">REAVIVA SUPPLY · Voltar à loja</a>
</footer>
</body>
</html>`;

  return sendHtml(res, html);
};


const cfg = window.REAVIVA_CONFIG || {};

const msg = document.querySelector('#msg');
const form = document.querySelector('#form');
const createButton = document.querySelector('#create');
const result = document.querySelector('#result');
const linkField = document.querySelector('#link');
const copyButton = document.querySelector('#copy');
const orderField = document.querySelector('#order');

let sup = null;
let authorized = false;

async function initialize() {
  form.hidden = true;
  result.hidden = true;

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    msg.textContent = 'Configuração do Supabase indisponível.';
    return;
  }

  try {
    const { createClient } = await import(
      'https://esm.sh/@supabase/supabase-js@2'
    );

    sup = createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey
    );

    const {
      data: { session },
      error
    } = await sup.auth.getSession();

    if (error || !session) {
      msg.textContent =
        'Faça login primeiro em /admin.html e retorne aqui.';
      return;
    }

    const { data, error: adminError } = await sup
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (adminError || !data) {
      msg.textContent =
        'Esta conta não possui acesso de administrador.';
      return;
    }

    authorized = true;
    msg.textContent =
      'Conectado. Somente pedidos confirmados podem gerar cobrança.';

    form.hidden = false;

  } catch (error) {
    console.error('pix_admin_auth_error', error);

    msg.textContent =
      'Não foi possível autenticar. Verifique o CMS.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!authorized || !sup) {
    msg.textContent =
      'Sessão administrativa não validada. Faça login novamente.';
    return;
  }

  const orderId = orderField.value.trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(orderId)) {
    msg.textContent = 'Informe um UUID válido para o pedido.';
    return;
  }

  createButton.disabled = true;
  copyButton.disabled = true;
  msg.textContent = 'Verificando pedido e preparando cobrança...';

  try {
    const {
      data: { session },
      error
    } = await sup.auth.getSession();

    if (error || !session) {
      throw Error('Sessão encerrada. Faça login no CMS.');
    }

    const response = await fetch('/api/pix-criar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token
      },
      body: JSON.stringify({
        order_id: orderId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw Error(
        data.error || 'Falha ao criar cobrança.'
      );
    }

    if (!data.checkoutPath ||
        !data.checkoutPath.startsWith('/pagamento.html?token=')) {
      throw Error('A API retornou um link de pagamento inválido.');
    }

    const checkoutUrl = new URL(
      data.checkoutPath,
      location.origin
    );

    if (checkoutUrl.origin !== location.origin) {
      throw Error('Origem do link de pagamento inválida.');
    }

    linkField.value = checkoutUrl.href;
    result.hidden = false;

    msg.textContent = data.reused
      ? 'Cobrança anterior recuperada. Confira antes de compartilhar.'
      : 'Cobrança gerada. Confira antes de compartilhar.';

  } catch (error) {
    console.error('pix_admin_create_error', error);

    msg.textContent =
      'Não foi possível emitir a cobrança: ' + error.message;

  } finally {
    createButton.disabled = false;
    copyButton.disabled = false;
  }
});

copyButton.addEventListener('click', async () => {
  const value = linkField.value;

  if (!value) {
    msg.textContent = 'Nenhum link disponível para copiar.';
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    msg.textContent = 'Link de pagamento copiado.';
  } catch (error) {
    linkField.focus();
    linkField.select();

    msg.textContent =
      'Não foi possível copiar automaticamente. Selecione e copie o link.';
  }
});

initialize();


(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const token = new URLSearchParams(location.search).get('token');
  const message = $('#message');
  const payment = $('#payment');
  const protocol = $('#protocol');
  const amount = $('#amount');
  const awaiting = $('#awaiting');
  const paid = $('#paid');
  const unavailable = $('#unavailable');
  const qr = $('#qr');
  const copycode = $('#copycode');
  const copyButton = $('#copy');

  let inFlight = false;
  let poll = null;
  let finished = false;

  function stopPolling() {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  }

  function showError(text) {
    message.textContent = text;
  }

  async function update() {
    if (inFlight || finished) return;

    if (!token) {
      showError('Link incompleto. Solicite outro à loja.');
      stopPolling();
      return;
    }

    inFlight = true;

    try {
      const response = await fetch(
        '/api/pix-checkout?token=' + encodeURIComponent(token),
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json'
          }
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error('Resposta inválida do servidor.');
      }

      if (!response.ok) {
        if (response.status === 503) {
          showError('Pagamento temporariamente indisponível. Tente novamente em instantes.');
        } else if (response.status === 403 || response.status === 404) {
          showError('Link inválido ou expirado. Solicite um novo link à loja.');
          stopPolling();
        } else {
          showError('Não foi possível consultar o pagamento. Tentaremos novamente.');
        }

        return;
      }

      if (
        !data ||
        !['pending', 'paid', 'unavailable'].includes(data.status) ||
        !Number.isFinite(Number(data.amount))
      ) {
        throw new Error('Dados de pagamento inválidos.');
      }

      payment.hidden = false;

      protocol.textContent = data.protocol || 'Pedido REAVIVA';
      amount.textContent = Number(data.amount).toLocaleString(
        'pt-BR',
        {
          style: 'currency',
          currency: 'BRL'
        }
      );

      // Limpa a exibição anterior
      qr.removeAttribute('src');
      qr.hidden = true;
      copycode.value = '';

      const isPaid = data.status === 'paid';
      const isPending = data.status === 'pending';

      paid.hidden = !isPaid;
      awaiting.hidden = !isPending;
      unavailable.hidden = isPending || isPaid;

      if (isPaid) {
        message.textContent = 'Pagamento confirmado!';
        finished = true;
        stopPolling();
        return;
      }

      if (isPending) {
        const qrData = data.qrCode || {};
        const code = String(qrData.copyPaste || '').trim();

        if (!code) {
          awaiting.hidden = true;
          unavailable.hidden = false;
          message.textContent = 'Código Pix indisponível. Entre em contato com a loja.';
          return;
        }

        copycode.value = code;

        if (qrData.imageUrl) {
          try {
            const imageUrl = new URL(qrData.imageUrl);

            if (imageUrl.protocol === 'https:') {
              qr.src = imageUrl.href;
              qr.hidden = false;
            }
          } catch {
            qr.hidden = true;
          }
        }

        message.textContent = 'Aguardando confirmação do pagamento…';
        return;
      }

      message.textContent = 'Esta cobrança não está disponível. Fale com a loja para receber um novo link.';

    } catch (error) {
      console.error('pix_checkout_update_failed', error);
      showError('Falha de conexão. Nova tentativa em instantes.');
    } finally {
      inFlight = false;
    }
  }

  async function copyPixCode() {
    const value = copycode.value.trim();

    if (!value) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        copycode.focus();
        copycode.select();

        const copied = document.execCommand('copy');

        if (!copied) {
          throw new Error('Não foi possível copiar automaticamente.');
        }
      }

      copyButton.textContent = 'Código copiado!';
    } catch (error) {
      console.error('pix_copy_failed', error);
      copycode.focus();
      copycode.select();
      copyButton.textContent = 'Selecione e copie o código';
    }

    setTimeout(() => {
      copyButton.textContent = 'Copiar código Pix';
    }, 2500);
  }

  copyButton.addEventListener('click', copyPixCode);

  // Primeira consulta imediata
  update();

  // Atualiza o status a cada 25 segundos
  poll = setInterval(() => {
    if (!document.hidden && !finished) {
      update();
    }
  }, 25000);

  // Atualiza quando o cliente retorna à página
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !finished) {
      update();
    }
  });

})();

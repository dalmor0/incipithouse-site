// incipithouse.com.br · compra do vitalício pelo Mercado Pago (ficha 2026-11-17-incipit-monetizacao).
// Na página de planos: lê o preço e o contador de fundador do servidor de licença e abre o pagamento.
// Na página /compra: mostra o estado da compra e a chave quando aprova. O preço vale só o do servidor.
(function () {
  var meta = document.querySelector('meta[name="incipit-licenca"]');
  if (!meta) return;
  var API = meta.content.replace(/\/$/, '');
  var reais = function (v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); };
  function pedir(metodo, caminho, corpo) {
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch(API + caminho, {
      method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer',
    }).then(function (r) { return r.json(); }).catch(function () {
      return { ok: false, texto: 'Sem conexão com o servidor de compra agora. Tente de novo em alguns minutos.' };
    }).finally(function () { if (t) clearTimeout(t); });
  }

  // ---------- planos ----------
  var botoes = Array.prototype.slice.call(document.querySelectorAll('[data-comprar]'));
  var status = document.querySelector('[data-compra-status]');
  if (botoes.length) {
    pedir('GET', '/v1/precos').then(function (d) {
      if (!d || !d.ok || !d.produtos) return; // sem resposta: fica o texto do site
      Object.keys(d.produtos).forEach(function (id) {
        var p = d.produtos[id];
        var el = document.querySelector('[data-preco="' + id + '"]');
        var depois = document.querySelector('[data-preco-depois="' + id + '"]');
        if (!p.a_venda) return;
        if (el) el.textContent = reais(p.preco);
        if (depois) {
          if (p.fundador && p.fundador.restam > 0 && p.preco < p.cheio) {
            depois.textContent = (p.fundador.restam === 1 ? 'resta 1' : 'restam ' + p.fundador.restam) + ' das ' + p.fundador.limite + ' licenças com esse preço; depois, ' + reais(p.cheio);
          } else depois.textContent = 'pago uma vez';
        }
        document.querySelectorAll('[data-rotulo-preco="' + id + '"]').forEach(function (b) { b.textContent = 'Comprar por ' + reais(p.preco); });
      });
    });
    botoes.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var original = b.textContent;
        botoes.forEach(function (x) { x.disabled = true; });
        b.textContent = 'Abrindo o pagamento...';
        if (status) status.textContent = '';
        pedir('POST', '/v1/checkout', { produto: b.getAttribute('data-comprar'), origem: 'site' }).then(function (r) {
          var link = r && r.ok && r.pagar ? r.pagar : '';
          var ok = false;
          try { var u = new URL(link); ok = (u.protocol === 'https:' && /(^|\.)mercadopago\.com(\.br)?$/.test(u.hostname)) || (u.hostname === '127.0.0.1' && location.hostname === '127.0.0.1'); } catch (e) { ok = false; }
          if (ok) {
            try { sessionStorage.setItem('incipit-compra', JSON.stringify({ ref: r.ref, t: r.t })); } catch (e) { /* aba anônima */ }
            location.href = link;
            return;
          }
          botoes.forEach(function (x) { x.disabled = false; });
          b.textContent = original;
          if (status) status.textContent = (r && r.texto) || 'Não deu pra abrir o pagamento agora. Tente de novo em alguns minutos.';
        });
      });
    });
  }

  // ---------- /compra ----------
  var caixa = document.querySelector('[data-compra]');
  if (!caixa) return;
  var q = new URLSearchParams(location.search);
  var ref = q.get('ref') || q.get('external_reference') || '';
  var tok = q.get('t') || '';
  if (!tok) { try { var s = JSON.parse(sessionStorage.getItem('incipit-compra') || '{}'); if (s.ref === ref) tok = s.t; } catch (e) { /* */ } }
  // o segredo sai da barra de endereço depois de lido (não fica no histórico nem vai pra outro site)
  if (history.replaceState) history.replaceState(null, '', location.pathname);
  try { if (ref && tok) sessionStorage.setItem('incipit-compra', JSON.stringify({ ref: ref, t: tok })); } catch (e) { /* */ }
  var mostrar = function (estado) {
    caixa.querySelectorAll('[data-estado]').forEach(function (el) { el.hidden = el.getAttribute('data-estado') !== estado; });
    caixa.setAttribute('aria-busy', estado === 'carregando' ? 'true' : 'false');
  };
  var preencher = function (sel, txt) { caixa.querySelectorAll(sel).forEach(function (el) { el.textContent = txt; }); };
  if (!/^inc_[0-9a-f]{24}$/.test(ref) || !tok) { mostrar('sem-link'); return; }
  var tentativas = 0;
  function olhar() {
    pedir('GET', '/v1/pedido/' + ref + '?t=' + encodeURIComponent(tok)).then(function (d) {
      tentativas++;
      if (!d || !d.ok) {
        if (d && d.erro === 'pedido') { mostrar('sem-link'); return; }
        preencher('[data-erro-texto]', (d && d.texto) || 'Sem conexão agora.');
        mostrar('erro');
        setTimeout(olhar, 15000);
        return;
      }
      preencher('[data-produto]', d.nome || 'Licença vitalícia');
      preencher('[data-valor]', reais(d.valor));
      if (d.estado === 'pago' && d.chave) {
        preencher('[data-chave]', d.chave);
        preencher('[data-numero]', d.numero || '');
        mostrar('pago');
        return;
      }
      if (d.estado === 'aberto') { mostrar('aguardando'); setTimeout(olhar, tentativas < 150 ? 4000 : 20000); return; }
      mostrar(d.estado === 'recusado' ? 'recusado' : d.estado === 'vencido' ? 'vencido' : d.estado === 'reembolsado' ? 'reembolsado' : 'erro');
    });
  }
  var copiar = caixa.querySelector('[data-copiar]');
  if (copiar) copiar.addEventListener('click', function () {
    var chave = (caixa.querySelector('[data-chave]') || {}).textContent || '';
    var feito = function () { copiar.textContent = 'Copiada'; setTimeout(function () { copiar.textContent = 'Copiar a chave'; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(chave).then(feito, function () { });
  });
  mostrar('carregando');
  olhar();
})();

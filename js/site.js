// incipithouse.com.br · o pouco de JavaScript do site. Sem ele, a página aparece inteira e funciona igual.
(function () {
  // 1. Entrada suave das seções que estão abaixo da tela (o que já está visível não mexe)
  var els = Array.prototype.slice.call(document.querySelectorAll('.entra'));
  if ('IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.removeAttribute('data-espera'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.setAttribute('data-espera', ''); io.observe(el); }
    });
  }

  // 2. Menu do celular: fecha ao tocar fora ou com Esc
  var menu = document.querySelector('.menu-cel');
  if (menu) {
    document.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }
})();

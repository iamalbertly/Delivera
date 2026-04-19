export function initSharedPageIdentityObserver(options = {}) {
  try {
    const titleSelector = options.titleSelector || 'main h1, .page-title, h1';
    const headerSelector = options.headerSelector || 'header .header-row';
    const fallbackHeaderSelector = options.fallbackHeaderSelector || 'header';
    const contextText = options.contextText || '';
    const trimLength = Number(options.trimLength) > 0 ? Number(options.trimLength) : 30;
    const observerThreshold = options.observerThreshold ?? 0;

    const titleEl = document.querySelector(titleSelector);
    if (!titleEl || typeof IntersectionObserver === 'undefined') return;
    const headerEl = document.querySelector(headerSelector) || document.querySelector(fallbackHeaderSelector);
    if (!headerEl) return;

    let contextEl = document.querySelector('.header-page-context');
    if (!contextEl) {
      contextEl = document.createElement('span');
      contextEl.className = 'header-page-context';
      contextEl.setAttribute('aria-hidden', 'true');
      headerEl.appendChild(contextEl);
    }

    const derivedText = contextText || (titleEl.textContent || '').trim().slice(0, trimLength);
    contextEl.textContent = derivedText;

    const observer = new IntersectionObserver((entries) => {
      const hidden = !entries[0].isIntersecting;
      contextEl.classList.toggle('visible', hidden);
    }, { threshold: observerThreshold });
    observer.observe(titleEl);
  } catch (_) {}
}

export function initSharedTableScrollIndicators() {
  try {
    document.addEventListener('scroll', (event) => {
      const target = event.target;
      if (!target || !target.classList || !target.classList.contains('data-table-scroll-wrap')) return;
      target.classList.toggle('scrolled-right', target.scrollLeft > 8);
    }, { passive: true, capture: true });
  } catch (_) {}
}

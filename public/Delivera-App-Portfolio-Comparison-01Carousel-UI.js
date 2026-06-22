import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function renderCard(card = {}) {
  const m = card.metrics || {};
  const selected = card.selected ? ' portfolio-squad-card--selected' : '';
  const statusClass = card.statusClass || 'watch';
  return `
    <article class="portfolio-squad-card portfolio-squad-card--${statusClass}${selected}"
      data-squad-key="${escapeHtml(card.projectKey)}"
      ${card.selected ? 'aria-current="true"' : ''}
      tabindex="0">
      <header class="portfolio-squad-card-head">
        <h3>${escapeHtml(card.squadName || card.projectKey)}</h3>
        <span class="portfolio-squad-status portfolio-squad-status--${statusClass}">${escapeHtml(card.status || 'Watch')}</span>
      </header>
      <dl class="portfolio-squad-metrics">
        <div><dt>Delivered</dt><dd>${Number(m.delivered) || 0}%</dd></div>
        <div><dt>Off-plan load</dt><dd>${Number(m.offPlanLoad) || 0}%</dd></div>
        <div><dt>Proof confidence</dt><dd>${Number(m.proofConfidence) || 0}%</dd></div>
        <div><dt>Commitments</dt><dd>${Number(m.commitments) || 0}</dd></div>
      </dl>
      <p class="portfolio-squad-explanation" data-squad-explanation="${escapeHtml(card.projectKey)}">${escapeHtml(card.explanation || '')}</p>
      <button type="button" class="btn btn-primary btn-compact portfolio-squad-action portfolio-squad-action--${statusClass}" data-squad-action="${escapeHtml(card.action?.id || 'review')}">${escapeHtml(card.action?.label || 'Review scope')} →</button>
      <a class="portfolio-squad-view" href="${escapeHtml(card.viewSquadHref || '#')}">View squad</a>
    </article>`;
}

export function renderPortfolioCarousel(comparison = {}) {
  const strip = comparison.actionsStrip || {};
  const cards = comparison.cards || [];
  const overflow = Number(comparison.overflowCount) || 0;
  return `
    <section class="portfolio-carousel-wrap" aria-label="Compare squads" data-portfolio-carousel>
      <div class="portfolio-carousel-head">
        <h2>Compare squads</h2>
        <p class="portfolio-carousel-strip" data-portfolio-actions-strip>
          Actions: ${strip.nudgesReady || 0} nudge${strip.nudgesReady === 1 ? '' : 's'} ready
          · ${strip.pending || 0} pending
          · Proof: ${escapeHtml(strip.proofLevel || 'Medium')}
        </p>
      </div>
      <div class="portfolio-carousel-controls">
        <button type="button" class="portfolio-carousel-arrow" data-carousel-dir="prev" aria-label="Previous squad">‹</button>
        <div class="portfolio-carousel-track" data-carousel-track tabindex="0" role="list">
          ${cards.map(renderCard).join('')}
          ${overflow > 0 ? `<div class="portfolio-squad-card portfolio-squad-card--overflow" role="listitem">+${overflow} more</div>` : ''}
        </div>
        <button type="button" class="portfolio-carousel-arrow" data-carousel-dir="next" aria-label="Next squad">›</button>
      </div>
      <div class="portfolio-carousel-dots" data-carousel-dots aria-hidden="true"></div>
    </section>`;
}

export function bindPortfolioCarousel(root, { onSelectSquad, onSquadAction } = {}) {
  if (!root) return;
  const track = root.querySelector('[data-carousel-track]');
  const dots = root.querySelector('[data-carousel-dots]');
  if (!track) return;
  const cards = () => Array.from(track.querySelectorAll('.portfolio-squad-card:not(.portfolio-squad-card--overflow)'));
  const scrollToIndex = (idx) => {
    const list = cards();
    if (!list.length) return;
    const i = Math.max(0, Math.min(list.length - 1, idx));
    list[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    dots?.querySelectorAll('button').forEach((b, n) => b.classList.toggle('is-active', n === i));
  };
  const rebuildDots = () => {
    if (!dots) return;
    const list = cards();
    dots.innerHTML = list.map((_, i) => `<button type="button" class="portfolio-carousel-dot${i === 0 ? ' is-active' : ''}" data-dot="${i}" aria-label="Squad ${i + 1}"></button>`).join('');
    dots.onclick = (ev) => {
      const btn = ev.target.closest('[data-dot]');
      if (!btn) return;
      scrollToIndex(Number(btn.getAttribute('data-dot')));
    };
  };
  rebuildDots();
  root.querySelector('[data-carousel-dir="prev"]')?.addEventListener('click', () => {
    const list = cards();
    const left = list.findIndex((c) => c.getBoundingClientRect().left >= track.getBoundingClientRect().left - 4);
    scrollToIndex(Math.max(0, left - 1));
  });
  root.querySelector('[data-carousel-dir="next"]')?.addEventListener('click', () => {
    const list = cards();
    const left = list.findIndex((c) => c.getBoundingClientRect().left >= track.getBoundingClientRect().left - 4);
    scrollToIndex(left + 1);
  });
  track.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') { ev.preventDefault(); root.querySelector('[data-carousel-dir="next"]')?.click(); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); root.querySelector('[data-carousel-dir="prev"]')?.click(); }
  });
  track.addEventListener('wheel', (ev) => {
    if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
    ev.preventDefault();
    track.scrollLeft += ev.deltaY;
  }, { passive: false });
  track.addEventListener('click', (ev) => {
    const card = ev.target.closest('.portfolio-squad-card[data-squad-key]');
    if (!card || ev.target.closest('button, a')) return;
    onSelectSquad?.(card.getAttribute('data-squad-key'));
  });
  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-squad-action]');
    if (!btn) return;
    ev.preventDefault();
    const card = btn.closest('[data-squad-key]');
    const key = card?.getAttribute('data-squad-key');
    const action = btn.getAttribute('data-squad-action');
    onSquadAction?.(key, action, card);
  });
}

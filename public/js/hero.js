// Homepage hero slideshow: featured products crossfade on a stage, one at a time.
// Timing is driven by a CSS animation on the active progress pill (animationend = next
// slide), so pausing is just animation-play-state and stays perfectly in sync.
import { h, $ } from './lib/dom.js';

const SWIPE_PX = 40;

/** Products shown in the hero: flagged ones first; if none are flagged, any with a photo. */
export function heroProducts(products) {
  const withImage = (p) => p.hero_image_url || p.image_url;
  const flagged = products.filter((p) => p.in_hero && withImage(p));
  return (flagged.length ? flagged : products.filter(withImage)).slice(0, 8);
}

export function mountHero({ products, money, onAdd, onView }) {
  const stage = $('#hero-stage');
  const slides = heroProducts(products);
  if (!stage || !slides.length) return; // keep the static fallback shelf

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;

  const slideEls = slides.map((p, i) => {
    const photo = Boolean(p.hero_image_url);
    return h('figure', { class: `hero-slide${photo ? ' is-photo' : ''}`, 'aria-hidden': String(i !== 0) },
      h('img', {
        src: p.hero_image_url || p.image_url, alt: p.name,
        loading: i === 0 ? 'eager' : 'lazy', decoding: 'async', fetchpriority: i === 0 ? 'high' : null,
      }));
  });

  const card = h('div', { class: 'hero-card', 'aria-live': 'polite' });
  const dots = h('div', { class: 'hero-dots', role: 'group', 'aria-label': 'Choose featured product' },
    slides.map((p, i) => h('button', {
      type: 'button', class: 'hero-dot', 'aria-label': `Show ${p.name}`,
      onclick: () => go(i, true),
    }, h('span', { class: 'hero-dot-fill', onanimationend: () => go(index + 1) }))));
  const arrow = (dir, label, d) => h('button', {
    type: 'button', class: `hero-arrow hero-arrow-${dir}`, 'aria-label': label,
    onclick: () => go(index + (dir === 'next' ? 1 : -1), true),
  }, svg(d));

  const controls = slides.length > 1
    ? h('div', { class: 'hero-controls' }, arrow('prev', 'Previous product', 'm15 18-6-6 6-6'), dots, arrow('next', 'Next product', 'm9 18 6-6-6-6'))
    : null;

  $('#hero-slides').replaceChildren(...slideEls);
  stage.append(card);
  if (controls) stage.append(controls);
  stage.classList.add('is-live');
  if (reduceMotion || slides.length < 2) stage.classList.add('is-static');

  function renderCard(p, animate) {
    const price = Number(p.price) > 0 ? money(p.price) : null;
    const content = h('div', { class: 'hero-card-inner' },
      h('div', { class: 'hero-card-text' },
        h('span', { class: 'eyebrow' }, p.category),
        h('button', { type: 'button', class: 'hero-card-name', onclick: () => onView(p) }, p.name),
        price ? h('span', { class: 'hero-card-price' }, price) : null),
      p.in_stock
        ? h('button', { type: 'button', class: 'btn btn-primary hero-card-add', onclick: () => onAdd(p.id), 'aria-label': `Add ${p.name} to cart` }, svg('M5 12h14 M12 5v14'), 'Add')
        : h('span', { class: 'badge-out' }, 'Out of stock'));
    if (animate) content.classList.add('is-entering');
    card.replaceChildren(content);
  }

  function go(next, byUser = false) {
    next = (next + slides.length) % slides.length;
    if (next === index && !byUser) return;
    slideEls[index].classList.remove('is-active');
    slideEls[index].setAttribute('aria-hidden', 'true');
    index = next;
    slideEls[index].classList.add('is-active');
    slideEls[index].setAttribute('aria-hidden', 'false');
    renderCard(slides[index], true);
    dots.querySelectorAll('.hero-dot').forEach((d, i) => {
      d.setAttribute('aria-current', String(i === index));
      // restart the fill animation on the newly active pill
      const fill = d.firstChild;
      fill.classList.remove('is-running');
      if (i === index) { void fill.offsetWidth; fill.classList.add('is-running'); }
    });
  }

  // pause while the visitor is looking closely or the tab is hidden
  const setPaused = (v) => stage.classList.toggle('is-paused', v);
  stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setPaused(true); });
  stage.addEventListener('pointerleave', () => setPaused(false));
  stage.addEventListener('focusin', () => setPaused(true));
  stage.addEventListener('focusout', () => setPaused(false));
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  // swipe on touch screens
  let startX = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') startX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1), true);
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1, true);
    if (e.key === 'ArrowLeft') go(index - 1, true);
  });

  slideEls[0].classList.add('is-active');
  renderCard(slides[0], false);
  if (controls) go(0, true);
}

function svg(d) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('class', 'icon');
  el.setAttribute('aria-hidden', 'true');
  for (const part of d.split(' M')) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', part.startsWith('M') || part.startsWith('m') ? part : `M${part}`);
    el.append(path);
  }
  return el;
}

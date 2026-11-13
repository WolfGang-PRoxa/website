import { $, $$, reduceMotion } from '../lib/dom';

/** Halo qui suit la souris sur les cartes */
export const bindSpotlight = (el: HTMLElement) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
};

export const initEffects = () => {
  $$('.spotlight').forEach(bindSpotlight);

  // Boutons magnétiques
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    $$('.magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.25;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  // Bandeau défilant : contenu dupliqué pour une boucle sans couture
  const track = $('.marquee__track');
  const marquee = $('.marquee');
  if (!track || !marquee) return;
  track.innerHTML += track.innerHTML;
  // Écrans tactiles : le bandeau défile, mais sans l'effet de survol
  if (reduceMotion || window.matchMedia('(hover: none)').matches) return;

  // Au survol : le bandeau ralentit progressivement et les mots ondulent
  $$('span', track).forEach((s, i) => s.style.setProperty('--i', String(i % 13)));
  let rate = 1;
  let target = 1;
  let frame = 0;
  const step = () => {
    rate += (target - rate) * 0.08;
    if (Math.abs(target - rate) < 0.004) rate = target;
    track.getAnimations().forEach((a) => a.updatePlaybackRate(rate));
    frame = rate === target ? 0 : requestAnimationFrame(step);
  };
  const easeTo = (value: number) => { target = value; if (!frame) frame = requestAnimationFrame(step); };
  marquee.addEventListener('pointerenter', () => { marquee.classList.add('is-hovered'); easeTo(0.2); });
  marquee.addEventListener('pointerleave', () => { marquee.classList.remove('is-hovered'); easeTo(1); });
};

import { $, reduceMotion } from '../lib/dom';

/* Bouton jour / nuit : le nouveau thème se propage en cercle depuis le bouton.
   Les clics peuvent s'enchaîner aussi vite qu'on veut : chaque clic est mis en file
   et joue sa propre propagation, d'autant plus rapide qu'il en reste à jouer.
   (Le navigateur ne peut animer qu'une transition de page à la fois.)

   Les barres du navigateur (barre d'adresse, boutons) ne font pas partie de la page :
   on ne peut pas les découper avec le cercle. Leur couleur suit donc la propagation :
   elle passe d'une teinte à l'autre pendant que le cercle balaie le bord de l'écran
   qui les touche (haut : couleur « theme-color » ; bas : fond de body, repris par Safari). */

const BASE_DURATION = 750; // ms
const MIN_DURATION = 260;

type RGB = [number, number, number];

const parseColor = (value: string): RGB => {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const n = Number.parseInt(full, 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (a: RGB, b: RGB, t: number) =>
  `#${a
    .map((v, i) =>
      Math.round(v + (b[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/* Tout sauf un disque : le contour extérieur puis le cercle (polygone fin), en « evenodd ».
   Les deux images clés ont le même nombre de points : le navigateur les interpole directement. */
const HOLE_POINTS = 48;
const holeClip = (cx: number, cy: number, r: number) => {
  const far = 1e5;
  const ring = Array.from({ length: HOLE_POINTS + 1 }, (_, i) => {
    const a = (i / HOLE_POINTS) * Math.PI * 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)}px ${(cy + r * Math.sin(a)).toFixed(2)}px`;
  });
  const outer = [
    `${-far}px ${-far}px`,
    `${far}px ${-far}px`,
    `${far}px ${far}px`,
    `${-far}px ${far}px`,
    `${-far}px ${-far}px`,
  ];
  return `polygon(evenodd, ${[...outer, ...ring, outer[0]].join(', ')})`;
};

/* Sur téléphone, la capture de la page s'étend sous les barres du navigateur (en bas de
   l'écran, à côté du pied de page) : l'onde doit aller jusque-là, sinon cette bande ne
   change qu'à la fin. On prend donc la hauteur de l'écran, pas seulement la zone visible. */
const coarse = window.matchMedia('(pointer: coarse)');
const visibleHeight = () => {
  if (!coarse.matches) return innerHeight;
  const portrait = innerHeight >= innerWidth;
  const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return Math.max(innerHeight, screenH);
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const initTheme = () => {
  const root = document.documentElement;
  const body = document.body;
  const button = $<HTMLButtonElement>('#theme-toggle');
  if (!button) return;

  let meta = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  const themeMeta = meta;

  const currentBg = () => getComputedStyle(root).getPropertyValue('--bg').trim();

  const syncMeta = () => {
    themeMeta.content = currentBg();
  };

  const apply = (theme: string) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* stockage indisponible */
    }
  };
  const flip = () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark');

  let pending = 0;
  let running = false;
  let current: Animation[] = [];

  const propagate = async (duration: number) => {
    const r = button.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const w = innerWidth;
    const h = visibleHeight();
    const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
    const touch = coarse.matches;

    // Éléments capturés à part (voir le CSS) ; ils partagent tous le même cercle
    // Le voile flou de la barre (et le contenu de la barre, qui doit rester au-dessus) est capturé
    // à part sur téléphone, où la capture perd son flou. Sur ordinateur, la barre reste dans la
    // capture de la page, sans calcul en plus.
    // Le bandeau « Ma stack », lui, reste dans la capture de la page et se met en pause pendant l'onde
    // (voir le CSS) : l'ancienne capture est figée, il doit donc l'être aussi dans le nouvel état.
    // (Capturé à part pour qu'il continue de défiler, il apparaissait à une autre position sur Safari.)
    const navBlur = touch ? ($('.nav.is-scrolled .nav__blur')?.getBoundingClientRect() ?? null) : null;
    const navInner = navBlur ? ($('.nav__inner')?.getBoundingClientRect() ?? null) : null;

    // Valeurs fixes de l'animation, posées une seule fois (les changer à chaque image recalcule
    // le style de toute la page) : ce qui bouge est animé par le navigateur, voir plus bas.
    const vars = (values: Record<string, string>) =>
      Object.entries(values).forEach(([name, value]) => root.style.setProperty(`--vt-${name}`, value));
    const from = parseColor(currentBg());
    let to = from;
    vars({ x: `${x}px`, y: `${y}px`, old: mix(from, from, 0), new: mix(from, from, 0) });
    root.classList.add('theme-switching'); // coupe les transitions CSS pendant la capture
    root.classList.toggle('vt-blur', !!navBlur);
    if (touch) body.style.backgroundColor = mix(from, from, 0); // le bas garde l'ancienne couleur

    const transition = document.startViewTransition(() => {
      flip();
      root.classList.add('vt-new');
      to = parseColor(currentBg());
      vars({ new: mix(to, to, 0) });
    });

    // Téléphone : couleur des barres du navigateur, par paliers (chaque changement repeint la page)
    const far = Math.max(x, w - x);
    const edges = { top: [y, Math.hypot(far, y)], bottom: [h - y, Math.hypot(far, h - y)] };
    let frame = 0;
    let lastTop = -1;
    let lastBottom = -1;
    const follow = () => {
      const progress = current[0]?.effect?.getComputedTiming().progress;
      if (progress != null) {
        const reach = radius * progress;
        const step = ([start, end]: number[]) =>
          Math.round(clamp01((reach - start) / Math.max(1, end - start)) * 8) / 8;
        const top = step(edges.top);
        const bottom = step(edges.bottom);
        if (top !== lastTop) {
          themeMeta.content = mix(from, to, top);
          lastTop = top;
        }
        if (bottom !== lastBottom) {
          body.style.backgroundColor = mix(from, to, bottom);
          lastBottom = bottom;
        }
      }
      frame = requestAnimationFrame(follow);
    };

    try {
      await transition.ready;
      // « forwards » : les découpes restent en place jusqu'au retrait des captures (sinon l'ancienne
      // image de la barre réapparaît entière une image avant la fin)
      const timing: KeyframeAnimationOptions = { duration, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' };
      const circle = (cx: number, cy: number, pseudoElement: string) =>
        root.animate(
          { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${radius}px at ${cx}px ${cy}px)`] },
          { ...timing, pseudoElement },
        );
      // Image translucide : l'ancienne doit disparaître là où passe l'onde, sinon elle reste visible dessous
      const hole = (cx: number, cy: number, pseudoElement: string) =>
        root.animate({ clipPath: [holeClip(cx, cy, 0), holeClip(cx, cy, radius)] }, { ...timing, pseudoElement });
      const pair = (name: string, rect: DOMRect) => [
        circle(x - rect.left, y - rect.top, `::view-transition-new(${name})`),
        hole(x - rect.left, y - rect.top, `::view-transition-old(${name})`),
      ];

      current = [
        circle(x, y, '::view-transition-new(root)'),
        // Rayon de l'onde, transmis au fond de la couche (voir le CSS)
        root.animate({ '--vt-r': ['0px', `${radius}px`] }, { ...timing, pseudoElement: '::view-transition' }),
        ...(navInner ? pair('nav-inner', navInner) : []),
        ...pair('theme-toggle', r),
        // Voile : tout le groupe suit l'onde, pour ne pas flouter une seconde fois l'ancienne capture,
        // déjà floue sous la barre.
        ...(navBlur ? [circle(x - navBlur.left, y - navBlur.top, '::view-transition-group(nav-blur)')] : []),
      ];

      if (touch) follow();
      await transition.finished;
    } catch {
      /* transition interrompue : le thème est tout de même appliqué */
    } finally {
      cancelAnimationFrame(frame);
      root.classList.remove('theme-switching', 'vt-blur', 'vt-new');
      body.style.backgroundColor = '';
      ['x', 'y', 'old', 'new'].forEach((name) => root.style.removeProperty(`--vt-${name}`));
      syncMeta();
      current = [];
    }
  };

  const run = async () => {
    running = true;
    while (pending > 0) {
      pending--;
      // Plus il reste de clics en attente, plus chaque propagation est courte
      const duration = Math.max(MIN_DURATION, BASE_DURATION / (1 + pending * 0.7));
      await propagate(duration);
    }
    running = false;
  };

  button.addEventListener('click', () => {
    if (!document.startViewTransition || reduceMotion) {
      flip();
      syncMeta();
      return;
    }
    pending++;
    // Un clic pendant une propagation accélère aussi celle en cours
    current.forEach((a) => a.updatePlaybackRate(Math.min(3, 1 + pending * 0.6)));
    if (!running) run();
  });
};

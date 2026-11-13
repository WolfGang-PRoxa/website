// Polices servies par le site lui-même (aucune requête vers un service tiers)
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/style.css';

import { initContributions } from './modules/contributions';
import { initEffects } from './modules/effects';
import { initLanguage } from './modules/language';
import { initNavigation } from './modules/navigation';
import { initRepos } from './modules/repos';
import { initReveal } from './modules/reveal';
import { initScrollbar } from './modules/scrollbar';
import { initTheme } from './modules/theme';

initTheme();
initLanguage();
initNavigation();
initScrollbar();
initReveal();
initEffects();
initRepos();
initContributions();

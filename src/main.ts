// Polices servies par le site lui-même (aucune requête vers un service tiers)
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/style.css';

import { initContact } from './modules/contact';
import { initContributions } from './modules/contributions';
import { initEffects } from './modules/effects';
import { initLanguage } from './modules/language';
import { initMenu, initNavigation } from './modules/navigation';
import { initRepos } from './modules/repos';
import { initReveal } from './modules/reveal';
import { initScrollbar } from './modules/scrollbar';
import { initStats } from './modules/stats';
import { initTheme } from './modules/theme';

initTheme();
initLanguage();
initNavigation();
initMenu();
initScrollbar();
initReveal();
initEffects();
initRepos();
initStats();
initContact();
initContributions();

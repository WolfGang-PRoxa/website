import { $$ } from '../lib/dom';
import { i18n } from '../lib/i18n';

/* Adresse e-mail : écrite en deux morceaux dans la page (data-mail-user, data-mail-domain)
   pour ne pas être ramassée par les robots, et recomposée ici. */
const applyMail = () => {
  $$<HTMLAnchorElement>('a[data-mail-user]').forEach((a) => {
    const address = `${a.dataset.mailUser}@${a.dataset.mailDomain}`;
    a.href = `mailto:${address}`;
    if (a.hasAttribute('data-mail-show')) a.textContent = address;
  });
};

export const initContact = () => {
  applyMail();
  i18n.onChange(applyMail); // les mentions légales sont réécrites à chaque changement de langue
};

import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'mg'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});
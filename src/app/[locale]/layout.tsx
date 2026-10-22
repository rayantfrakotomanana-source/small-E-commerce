import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { CartProvider } from './cart-context';
import './globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'fr' | 'mg')) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return <html lang={locale}><body><NextIntlClientProvider messages={messages}><CartProvider>{children}</CartProvider></NextIntlClientProvider></body></html>;
}
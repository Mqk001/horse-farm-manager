import { z } from 'zod';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD'] as const;
export function completionDetails(data: FormData) {
  const notes = z.string().transform(value => value.replace(/\r\n?/g, '\n').trim()).pipe(z.string().max(2000)).parse(data.get('completionNotes') ?? '');
  const product = z.string().trim().max(200).parse(data.get('productUsed') ?? '');
  const amount = z.string().trim().max(12).parse(data.get('cost') ?? '');
  const currency = z.enum(CURRENCIES).parse(data.get('costCurrency') ?? 'USD');
  if (amount && !/^\d{1,7}(\.\d{1,2})?$/.test(amount)) throw new Error('Enter a nonnegative cost with at most two decimal places.');
  const [whole, fraction = ''] = amount.split('.');
  const cents = amount ? Number(whole) * 100 + Number(fraction.padEnd(2, '0')) : null;
  return { completionNotes: notes || null, productUsed: product || null, costCents: cents, costCurrency: cents === null ? null : currency };
}
export function displayCost(cents: number | null, currency: string | null) {
  if (cents === null || !CURRENCIES.includes(currency as typeof CURRENCIES[number])) return '';
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

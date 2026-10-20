import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('unisce più classi in una stringa sola', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });

  it('ignora i valori vuoti o falsi', () => {
    expect(cn('flex', undefined, null, false, '', 'gap-2')).toBe('flex gap-2');
  });

  it('accetta classi condizionali (oggetti e liste)', () => {
    expect(cn('flex', { hidden: false, 'font-bold': true }, ['gap-2'])).toBe(
      'flex font-bold gap-2',
    );
  });

  it('risolve i conflitti Tailwind: vince l\'ultima classe', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('risolve i conflitti anche con i token di significato', () => {
    expect(cn('bg-primary', 'bg-danger')).toBe('bg-danger');
    expect(cn('text-sm', 'text-danger-text')).toBe('text-sm text-danger-text');
  });

  it('lascia passare le classi che non confliggono', () => {
    expect(cn('rounded-base', 'shadow-base', 'border')).toBe(
      'rounded-base shadow-base border',
    );
  });
});

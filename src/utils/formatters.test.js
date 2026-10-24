import { dataLocalISO } from './formatters';

test('mantém o dia local na virada do dia UTC e na virada do ano', () => {
  // Construtor local: este teste verifica a data civil independentemente
  // do fuso do executor; o CI também pode executá-lo com TZ=America/Bahia.
  expect(dataLocalISO(new Date(2026, 8, 19, 23, 30))).toBe('2026-09-19');
  expect(dataLocalISO(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  expect(dataLocalISO(new Date(2027, 0, 1, 0, 15))).toBe('2027-01-01');
});

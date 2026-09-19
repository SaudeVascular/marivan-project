import { dataBrasileiraParaISO, formatarDataDigitada } from './mascaras';

describe('máscara da data de nascimento', () => {
  test('avança automaticamente de dia para mês e de mês para ano', () => {
    expect(formatarDataDigitada('12', true)).toBe('12/');
    expect(formatarDataDigitada('12/08', true)).toBe('12/08/');
    expect(formatarDataDigitada('12/08/1980', true)).toBe('12/08/1980');
  });

  test('permite apagar os separadores sem recolocá-los', () => {
    expect(formatarDataDigitada('12', false)).toBe('12');
    expect(formatarDataDigitada('12/08', false)).toBe('12/08');
  });

  test('converte somente datas válidas para o formato do banco', () => {
    expect(dataBrasileiraParaISO('29/02/2024')).toBe('2024-02-29');
    expect(dataBrasileiraParaISO('31/02/2024')).toBe('');
    expect(dataBrasileiraParaISO('1/2/2024')).toBe('');
  });
});

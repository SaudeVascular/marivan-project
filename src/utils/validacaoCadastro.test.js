import { cnpjValido, cnsValido, cpfValido } from './validacaoCadastro';
import { formatarCNPJ } from './mascaras';

test('CPF: dígitos verificadores, com ou sem máscara', () => {
  expect(cpfValido('529.982.247-25')).toBe(true);
  expect(cpfValido('52998224725')).toBe(true);
  expect(cpfValido('529.982.247-24')).toBe(false);
  expect(cpfValido('111.111.111-11')).toBe(false);
  expect(cpfValido('5299822472')).toBe(false);
});

test('CNS: definitivo e provisório (mesmos exemplos do teste do banco)', () => {
  expect(cnsValido('100000000060018')).toBe(true);
  expect(cnsValido('700000000000005')).toBe(true);
  expect(cnsValido('898001160660001')).toBe(true);
  expect(cnsValido('123456789012345')).toBe(false);
});

test('CNPJ numérico e alfanumérico (mesmos exemplos do teste do banco)', () => {
  expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
  expect(cnpjValido('12abc34501de35')).toBe(true);
  expect(cnpjValido('11222333000182')).toBe(false);
  expect(cnpjValido('00000000000000')).toBe(false);
  expect(formatarCNPJ('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  expect(formatarCNPJ('11222')).toBe('11.222');
});

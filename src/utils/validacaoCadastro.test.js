import { cnsValido, cpfValido } from './validacaoCadastro';

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

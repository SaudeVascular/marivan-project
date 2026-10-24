import { SENHA_MINIMO_CARACTERES, validarSenha } from './security';

test('exige pelo menos 12 caracteres', () => {
  expect(SENHA_MINIMO_CARACTERES).toBe(12);
  expect(validarSenha('Curta1')).toContain('12 caracteres');
});

test('exige maiúscula, minúscula e número', () => {
  expect(validarSenha('apenasminusculas1')).toContain('maiúscula');
  expect(validarSenha('APENASMAIUSCULAS1')).toContain('minúscula');
  expect(validarSenha('SemQualquerNumero')).toContain('número');
});

test('aceita senha que atende à política', () => {
  expect(validarSenha('ClinicaSegura2026')).toBe('');
});

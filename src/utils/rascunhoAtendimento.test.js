import { RASCUNHO_ATENDIMENTO_PREFIX, limparRascunhosAtendimento } from './rascunhoAtendimento';

beforeEach(() => {
  localStorage.clear();
});

test('recupera o rascunho salvo pelo prefixo do paciente', () => {
  const pacienteId = 'paciente-123';
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId, 'texto digitado e não salvo ainda');

  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId)).toBe('texto digitado e não salvo ainda');
});

test('logout limpa todos os rascunhos clínicos, de qualquer paciente', () => {
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1', 'rascunho 1');
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-2', 'rascunho 2');

  limparRascunhosAtendimento();

  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1')).toBeNull();
  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-2')).toBeNull();
});

test('logout NÃO mexe em preferências de UI que não são dado clínico (ex: tamanho do painel)', () => {
  localStorage.setItem('pep_split_prontuario', '60');
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1', 'rascunho clínico');

  limparRascunhosAtendimento();

  expect(localStorage.getItem('pep_split_prontuario')).toBe('60');
  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1')).toBeNull();
});

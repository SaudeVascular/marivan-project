import {
  RASCUNHO_ATENDIMENTO_PREFIX,
  limparRascunhosAtendimento,
  lerRascunhoAtendimento,
  salvarRascunhoAtendimento,
} from './rascunhoAtendimento';

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

test('salva e recupera o texto junto do id do registro já persistido no servidor', () => {
  const pacienteId = 'paciente-123';
  salvarRascunhoAtendimento(pacienteId, 'texto do atendimento', 'registro-abc');

  expect(lerRascunhoAtendimento(pacienteId)).toEqual({
    texto: 'texto do atendimento',
    registroId: 'registro-abc',
  });
});

test('sem id de registro salvo, volta registroId null (rascunho só local)', () => {
  const pacienteId = 'paciente-123';
  salvarRascunhoAtendimento(pacienteId, 'texto ainda não salvo no prontuário');

  expect(lerRascunhoAtendimento(pacienteId)).toEqual({
    texto: 'texto ainda não salvo no prontuário',
    registroId: null,
  });
});

test('lê rascunho no formato antigo (texto puro, sem registroId) sem quebrar', () => {
  const pacienteId = 'paciente-123';
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId, 'rascunho salvo antes desta mudança');

  expect(lerRascunhoAtendimento(pacienteId)).toEqual({
    texto: 'rascunho salvo antes desta mudança',
    registroId: null,
  });
});

test('texto vazio remove o rascunho salvo em vez de gravar uma entrada vazia', () => {
  const pacienteId = 'paciente-123';
  salvarRascunhoAtendimento(pacienteId, 'texto qualquer', 'registro-abc');
  salvarRascunhoAtendimento(pacienteId, '', null);

  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId)).toBeNull();
  expect(lerRascunhoAtendimento(pacienteId)).toEqual({ texto: '', registroId: null });
});

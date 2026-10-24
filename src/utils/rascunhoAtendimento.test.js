import {
  RASCUNHO_ATENDIMENTO_PREFIX,
  limparRascunhosAtendimento,
  limparRascunhosLegados,
  lerRascunhoAtendimento,
  salvarRascunhoAtendimento,
} from './rascunhoAtendimento';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('recupera texto e vínculo com o servidor somente para o mesmo usuário e paciente', () => {
  salvarRascunhoAtendimento('paciente-1', 'texto clínico', 'registro-1', 'medico-1', 4);
  expect(lerRascunhoAtendimento('paciente-1', 'medico-1')).toEqual({ texto: 'texto clínico', registroId: 'registro-1', versao: 4 });
  expect(lerRascunhoAtendimento('paciente-1', 'medico-2')).toEqual({ texto: '', registroId: null, versao: null });
  expect(lerRascunhoAtendimento('paciente-2', 'medico-1')).toEqual({ texto: '', registroId: null, versao: null });
  expect(localStorage.length).toBe(0);
});

test('rascunhos de usuários diferentes não sobrescrevem uns aos outros', () => {
  salvarRascunhoAtendimento('paciente-1', 'texto A', null, 'medico-1');
  salvarRascunhoAtendimento('paciente-1', 'texto B', null, 'medico-2');
  expect(lerRascunhoAtendimento('paciente-1', 'medico-1').texto).toBe('texto A');
  expect(lerRascunhoAtendimento('paciente-1', 'medico-2').texto).toBe('texto B');
});

test('limpa rascunhos de ambas as versões preservando preferências e token', () => {
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1', 'legado');
  localStorage.setItem('pep_split_prontuario', '60');
  sessionStorage.setItem('token-teste', 'sessao');
  sessionStorage.setItem('pep_operacao_clinica_teste', 'pedido clínico pendente');
  salvarRascunhoAtendimento('paciente-1', 'texto', null, 'medico-1');
  limparRascunhosAtendimento();
  expect(localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1')).toBeNull();
  expect(lerRascunhoAtendimento('paciente-1', 'medico-1').texto).toBe('');
  expect(localStorage.getItem('pep_split_prontuario')).toBe('60');
  expect(sessionStorage.getItem('token-teste')).toBe('sessao');
  expect(sessionStorage.getItem('pep_operacao_clinica_teste')).toBeNull();
});

test('descarta formato legado sem autor e preserva rascunho da sessão no reload', () => {
  localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + 'paciente-1', 'autor desconhecido');
  salvarRascunhoAtendimento('paciente-1', 'autor conhecido', null, 'medico-1');
  limparRascunhosLegados();
  expect(localStorage.length).toBe(0);
  expect(lerRascunhoAtendimento('paciente-1', 'medico-1').texto).toBe('autor conhecido');
});

test('texto vazio remove apenas o rascunho correspondente', () => {
  salvarRascunhoAtendimento('paciente-1', 'texto', null, 'medico-1');
  salvarRascunhoAtendimento('paciente-2', 'outro texto', null, 'medico-1');
  salvarRascunhoAtendimento('paciente-1', '', null, 'medico-1');
  expect(lerRascunhoAtendimento('paciente-1', 'medico-1').texto).toBe('');
  expect(lerRascunhoAtendimento('paciente-2', 'medico-1').texto).toBe('outro texto');
});

test('recusa escrita sem identidade autenticada', () => {
  expect(() => salvarRascunhoAtendimento('paciente-1', 'texto')).toThrow();
  expect(sessionStorage.length).toBe(0);
});

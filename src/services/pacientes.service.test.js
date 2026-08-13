import { supabase, criarQueryBuilder, resetSupabaseMockPadrao } from './supabase';
import { pacientesService } from './pacientes.service';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
});

function prepararUpdate() {
  const update = jest.fn();
  const tabela = criarQueryBuilder({ data: null, error: null });
  update.mockReturnValue(tabela);
  supabase.from.mockImplementation((nome) => {
    if (nome === 'pacientes') return { update };
    return criarQueryBuilder({
      single: { data: { id: 'paciente-1', nome: 'Maria', ativo: true }, error: null },
    });
  });
  return update;
}

test('atualização cadastral não envia nem apaga campos clínicos', async () => {
  const update = prepararUpdate();

  await pacientesService.atualizarCadastro('paciente-1', {
    nome: 'Maria da Silva',
    telefone: '(71) 99999-9999',
    cpf: '123.456.789-00',
    nascimento: '1980-01-01',
    nomeMae: 'Ana',
    cep: '40000-000',
    endereco: 'Rua A',
    // Simula o valor mascarado recebido por uma Recepcionista.
    alergias: '',
  });

  const payload = update.mock.calls[0][0];
  expect(payload).toMatchObject({ nome: 'Maria da Silva', telefone: '(71) 99999-9999' });
  expect(payload).not.toHaveProperty('alergias');
  expect(payload).not.toHaveProperty('has');
  expect(payload).not.toHaveProperty('medicamentos_uso');
});

test('atualização clínica envia somente campos clínicos', async () => {
  const update = prepararUpdate();

  await pacientesService.atualizarClinicos('paciente-1', {
    alergias: 'Dipirona',
    has: 'Sim',
    dm: 'Não',
    medicamentosUso: 'Losartana',
    nome: 'nome que não deve ser alterado',
  });

  const payload = update.mock.calls[0][0];
  expect(payload).toMatchObject({
    alergias: 'Dipirona', has: 'Sim', dm: 'Não', medicamentos_uso: 'Losartana',
  });
  expect(payload).not.toHaveProperty('nome');
  expect(payload).not.toHaveProperty('cpf');
  expect(payload).not.toHaveProperty('telefone');
});

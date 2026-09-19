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
    numero: '123',
    complemento: 'Apto 201',
    // Simula o valor mascarado recebido por uma Recepcionista.
    alergias: '',
    outrasComorbidades: '',
  });

  const payload = update.mock.calls[0][0];
  expect(payload).toMatchObject({
    nome: 'Maria da Silva',
    telefone: '(71) 99999-9999',
    numero: '123',
    complemento: 'Apto 201',
  });
  expect(payload).not.toHaveProperty('alergias');
  expect(payload).not.toHaveProperty('has');
  expect(payload).not.toHaveProperty('medicamentos_uso');
  expect(payload).not.toHaveProperty('outras_comorbidades');
});

test('cadastro inicial não envia alergias ou outros dados clínicos', async () => {
  const insert = jest.fn(() => ({
    select: () => ({
      single: () => Promise.resolve({ data: { id: 'paciente-1' }, error: null }),
    }),
  }));

  supabase.from.mockImplementation((nome) => {
    if (nome === 'pacientes') return { insert };
    return criarQueryBuilder({
      single: { data: { id: 'paciente-1', nome: 'Maria', ativo: true }, error: null },
    });
  });

  await pacientesService.criar({
    nome: 'Maria',
    telefone: '(71) 99999-9999',
    alergias: 'Dipirona',
    outrasComorbidades: 'Doença renal crônica',
  });

  const payload = insert.mock.calls[0][0][0];
  expect(payload).toMatchObject({ nome: 'Maria', telefone: '(71) 99999-9999' });
  expect(payload).not.toHaveProperty('alergias');
  expect(payload).not.toHaveProperty('outras_comorbidades');
  expect(payload).not.toHaveProperty('medicamentos_uso');
});

test('atualização clínica envia somente campos clínicos', async () => {
  const update = prepararUpdate();

  await pacientesService.atualizarClinicos('paciente-1', {
    alergias: 'Dipirona',
    has: 'Sim',
    dm: 'Não',
    medicamentosUso: 'Losartana',
    outrasComorbidades: 'Doença renal crônica',
    nome: 'nome que não deve ser alterado',
  });

  const payload = update.mock.calls[0][0];
  expect(payload).toMatchObject({
    alergias: 'Dipirona', has: 'Sim', dm: 'Não', medicamentos_uso: 'Losartana',
    outras_comorbidades: 'Doença renal crônica',
  });
  expect(payload).not.toHaveProperty('nome');
  expect(payload).not.toHaveProperty('cpf');
  expect(payload).not.toHaveProperty('telefone');
});

import { supabase, criarQueryBuilder, resetSupabaseMockPadrao } from './supabase';
import { pacientesService } from './pacientes.service';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
});

// Edição vai pela função atualizar_paciente: `update.mock.calls[i][0]` é
// o p_dados enviado e `[i][1]` o resto dos parâmetros.
function prepararUpdate() {
  const update = jest.fn();
  supabase.rpc.mockImplementation((nome, { p_dados, ...resto }) => {
    if (nome === 'atualizar_paciente') update(p_dados, resto);
    return Promise.resolve({ data: null, error: null });
  });
  supabase.from.mockImplementation(() => criarQueryBuilder({
    single: { data: { id: 'paciente-1', nome: 'Maria', ativo: true }, error: null },
  }));
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
  }, 1);

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
  }, 1);

  const payload = update.mock.calls[0][0];
  expect(payload).toMatchObject({
    alergias: 'Dipirona', has: 'Sim', dm: 'Não', medicamentos_uso: 'Losartana',
    outras_comorbidades: 'Doença renal crônica',
  });
  expect(payload).not.toHaveProperty('nome');
  expect(payload).not.toHaveProperty('cpf');
  expect(payload).not.toHaveProperty('telefone');
});

describe('busca no servidor', () => {
  const { montarFiltroBusca } = jest.requireActual('./pacientes.service');

  test('vírgula, parênteses e aspas não quebram nem injetam filtro', () => {
    expect(montarFiltroBusca('Silva, (Ana)')).toBe(
      'nome.ilike."%Silva, (Ana)%",nome_mae.ilike."%Silva, (Ana)%",cpf.ilike."%Silva, (Ana)%"');
    expect(montarFiltroBusca('x"),id.eq.(1')).toBe(
      'nome.ilike."%x),id.eq.(1%",nome_mae.ilike."%x),id.eq.(1%",cpf.ilike."%x),id.eq.(1%"');
    expect(montarFiltroBusca('100%*')).toContain('nome.ilike."%100%"');
    expect(montarFiltroBusca('   ')).toBeNull();
  });

  test('CPF só com números também procura o CPF com máscara', () => {
    expect(montarFiltroBusca('12345678900')).toContain('cpf.ilike."%123.456.789-00%"');
    expect(montarFiltroBusca('1234')).toContain('cpf.ilike."%123.4%"');
  });

  test('data DD/MM/AAAA procura a data de nascimento', () => {
    expect(montarFiltroBusca('01/02/1980')).toContain('nascimento.eq.1980-02-01');
  });

  test('pagina pelo range e devolve o total', async () => {
    const range = jest.fn();
    const or = jest.fn();
    const builder = criarQueryBuilder({ data: [{ id: 'p1', nome: 'ana' }], error: null, count: 120 });
    builder.range = (...args) => { range(...args); return builder; };
    builder.or = (...args) => { or(...args); return builder; };
    builder.then = (resolve) => resolve({ data: [{ id: 'p1', nome: 'ana' }], error: null, count: 120 });
    supabase.from.mockReturnValue(builder);

    const r = await pacientesService.buscar({ termo: 'ana', limite: 50, offset: 50 });
    expect(supabase.from).toHaveBeenCalledWith('pacientes_view');
    expect(range).toHaveBeenCalledWith(50, 99);
    expect(or).toHaveBeenCalledWith(expect.stringContaining('nome.ilike."%ana%"'));
    expect(r.total).toBe(120);
    expect(r.itens[0].nome).toBe('Ana');
  });

  test('sem termo lista sem filtro', async () => {
    const or = jest.fn();
    const builder = criarQueryBuilder({ data: [], error: null });
    builder.or = (...args) => { or(...args); return builder; };
    supabase.from.mockReturnValue(builder);
    await pacientesService.buscar();
    expect(or).not.toHaveBeenCalled();
  });

  test('buscarPorIds consulta em lotes de 100, sem repetir ids', async () => {
    const lotes = [];
    supabase.from.mockImplementation(() => {
      const b = criarQueryBuilder({ data: [], error: null });
      b.in = (_, ids) => { lotes.push(ids); return b; };
      return b;
    });
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    await pacientesService.buscarPorIds([...ids, 'id-0', null]);
    expect(lotes.map(l => l.length)).toEqual([100, 50]);
  });
});

test('edição envia a versão esperada e o grupo de campos', async () => {
  const update = prepararUpdate();
  await pacientesService.atualizarCadastro('paciente-1', { nome: 'Maria' }, 4);
  expect(update.mock.calls[0][1]).toEqual({ p_id: 'paciente-1', p_grupo: 'cadastro', p_versao_esperada: 4 });
  expect(update.mock.calls[0][0]).toHaveProperty('nome', 'Maria');

  await pacientesService.atualizarClinicos('paciente-1', { alergias: 'Dipirona' }, 7);
  expect(update.mock.calls[1][1]).toEqual({ p_id: 'paciente-1', p_grupo: 'clinico', p_versao_esperada: 7 });

  await pacientesService.deletar('paciente-1', 5);
  expect(update.mock.calls[2]).toEqual([{ ativo: false }, { p_id: 'paciente-1', p_grupo: 'ativo', p_versao_esperada: 5 }]);
  expect(supabase.from).not.toHaveBeenCalledWith('pacientes');
});

test('sem a versão da tela, nem tenta gravar', async () => {
  const update = prepararUpdate();
  await expect(pacientesService.atualizarCadastro('paciente-1', { nome: 'Maria' })).rejects.toThrow(/Recarregue o paciente/);
  await expect(pacientesService.atualizarClinicos('paciente-1', {}, null)).rejects.toThrow(/Recarregue o paciente/);
  await expect(pacientesService.deletar('paciente-1')).rejects.toThrow(/Recarregue o paciente/);
  expect(update).not.toHaveBeenCalled();
});

test('conflito do banco chega à tela com o código P4090', async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: Object.assign(new Error('alterado por outra pessoa'), { code: 'P4090' }) });
  await expect(pacientesService.atualizarCadastro('paciente-1', { nome: 'Maria' }, 2)).rejects.toMatchObject({ code: 'P4090' });
});

test('reativar lê a versão atual antes', async () => {
  const update = prepararUpdate();
  supabase.from.mockImplementation(() => criarQueryBuilder({ single: { data: { versao_cadastro: 9 }, error: null } }));
  await pacientesService.reativar('paciente-1');
  expect(update).toHaveBeenCalledWith({ ativo: true }, { p_id: 'paciente-1', p_grupo: 'ativo', p_versao_esperada: 9 });
});

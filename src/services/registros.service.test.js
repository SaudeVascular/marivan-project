import { supabase, criarQueryBuilder, resetSupabaseMockPadrao } from './supabase';
import { registrosService, salvarRegistroComFallback } from './registros.service';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
});

const paciente = { id: 'paciente-1', registros: [{ id: 'antigo' }] };
const registro = { tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto digitado pelo médico' };

test('salvar atendimento com sucesso: grava o registro e some do estado local só com o que veio do banco', async () => {
  const registroSalvo = {
    id: 'novo-id',
    tipo: 'Consulta',
    titulo: 'Consulta',
    conteudo: 'Texto digitado pelo médico',
    data: '2026-07-25',
    hora: '10:00',
    created_by: 'user-1',
    created_at: '2026-07-25T10:00:00Z',
    status: 'Assinado',
  };
  supabase.from.mockImplementationOnce(() => criarQueryBuilder({ single: { data: registroSalvo, error: null } }));

  const setPacientes = jest.fn();
  const resultado = await salvarRegistroComFallback({
    registro, paciente, userId: 'user-1', pacientes: [paciente], setPacientes, contexto: 'consulta',
  });

  expect(resultado.ok).toBe(true);
  expect(resultado.registro.id).toBe('novo-id');
  expect(setPacientes).toHaveBeenCalledTimes(1);
  const pacientesAtualizados = setPacientes.mock.calls[0][0];
  expect(pacientesAtualizados[0].registros[0].id).toBe('novo-id');
});

test('preserva o texto quando o servidor falha: não inventa um registro local, só avisa do erro', async () => {
  supabase.from.mockImplementationOnce(() => criarQueryBuilder({
    single: { data: null, error: new Error('Falha de conexão') },
  }));

  const setPacientes = jest.fn();
  const resultado = await salvarRegistroComFallback({
    registro, paciente, userId: 'user-1', pacientes: [paciente], setPacientes, contexto: 'consulta',
  });

  expect(resultado.ok).toBe(false);
  expect(resultado.error).toBeInstanceOf(Error);
  // Nenhum registro otimista/falso é inserido no estado local — o texto
  // digitado continua só na tela (rascunho), não em pacientes.registros.
  expect(setPacientes).not.toHaveBeenCalled();
});

test('cliente não envia identidade nem horário de assinatura ao criar registro', async () => {
  const resposta = {
    id: 'novo-id', tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto',
    status: 'Assinado', created_by: 'user-1',
  };
  const builder = criarQueryBuilder({ single: { data: resposta, error: null } });
  const insert = jest.fn(() => builder);
  builder.insert = insert;
  supabase.from.mockReturnValue(builder);

  await registrosService.criar({
    tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto', status: 'Assinado',
    assinadoPorNome: 'Nome falsificado', assinadoPorRegistro: 'CRM falso',
  }, 'paciente-1', 'user-1');

  const payload = insert.mock.calls[0][0][0];
  expect(payload).not.toHaveProperty('assinado_em');
  expect(payload).not.toHaveProperty('assinado_por_nome');
  expect(payload).not.toHaveProperty('assinado_por_registro');
});

test('assinar envia somente a transição de status', async () => {
  const resposta = {
    id: 'registro-1', tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto',
    status: 'Assinado', created_by: 'user-1',
  };
  const builder = criarQueryBuilder({ single: { data: resposta, error: null } });
  const update = jest.fn(() => builder);
  builder.update = update;
  supabase.from.mockReturnValue(builder);

  await registrosService.assinar('registro-1');

  expect(update).toHaveBeenCalledWith({ status: 'Assinado' });
});

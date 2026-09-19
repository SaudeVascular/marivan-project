import { supabase, resetSupabaseMockPadrao } from './supabase';
import { registrosService, salvarRegistroComFallback, aplicarRegistroConfirmado, confirmarRecebimentoRegistro } from './registros.service';
import { OPERACAO_CLINICA_PREFIX } from '../utils/operacaoClinica';

jest.mock('./supabase');
const paciente = { id: 'paciente-1', registros: [{ id: 'antigo' }] };
const registro = { tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto clínico' };
const resposta = {
  id: 'novo-id', paciente_id: paciente.id, ...registro, versao: 1,
  status: 'Rascunho', created_by: 'user-1', data: '2026-09-19', hora: '10:00',
};

beforeEach(() => {
  sessionStorage.clear();
  resetSupabaseMockPadrao();
  supabase.rpc.mockResolvedValue({ data: resposta, error: null });
});
afterEach(() => jest.useRealTimers());

const criar = (campos = registro) => registrosService.criar(campos, paciente.id, 'user-1');

test('insere no estado somente o registro confirmado e preserva mudanças recentes do cache', async () => {
  const setPacientes = jest.fn();
  const resultado = await salvarRegistroComFallback({ registro, paciente, userId: 'user-1', setPacientes });
  expect(resultado.ok).toBe(true);
  const recente = [{ ...paciente, nome: 'Nome atualizado', registros: [{ id: 'recente' }] }];
  const atualizado = setPacientes.mock.calls[0][0](recente);
  expect(atualizado[0].nome).toBe('Nome atualizado');
  expect(atualizado[0].registros.map(r => r.id)).toEqual(['novo-id', 'recente']);
});

test('falha de rede não inventa registro e mantém o identificador para nova tentativa', async () => {
  supabase.rpc.mockRejectedValue(new Error('offline'));
  const setPacientes = jest.fn();
  const resultado = await salvarRegistroComFallback({ registro, paciente, userId: 'user-1', setPacientes });
  expect(resultado.error.code).toBe('RESULTADO_INCERTO');
  expect(setPacientes).not.toHaveBeenCalled();
  expect(Object.keys(sessionStorage).some(chave => chave.startsWith(OPERACAO_CLINICA_PREFIX))).toBe(true);
});

test('resposta perdida depois do commit é reconciliada repetindo o mesmo pedido', async () => {
  supabase.rpc.mockRejectedValueOnce(new Error('Conexão fechada depois do commit'));
  const salvo = await criar();
  expect(salvo.id).toBe('novo-id');
  expect(supabase.rpc).toHaveBeenCalledTimes(2);
  expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1]);
});

test('timeout depois do commit não muda o ID nem o conteúdo da operação', async () => {
  jest.useFakeTimers('modern');
  supabase.rpc.mockImplementationOnce(() => new Promise(() => {}));
  const pendente = criar();
  jest.advanceTimersByTime(8000);
  const salvo = await pendente;
  expect(salvo.id).toBe('novo-id');
  expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1]);
  expect(jest.getTimerCount()).toBe(0);
});

test('repetição em outro momento recupera pedido persistido, inclusive sua data original', async () => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date(2026, 8, 19, 23, 59));
  supabase.rpc.mockRejectedValue(new Error('offline'));
  await expect(criar()).rejects.toMatchObject({ code: 'RESULTADO_INCERTO' });
  const parametros = supabase.rpc.mock.calls[0][1];
  jest.setSystemTime(new Date(2026, 8, 20, 0, 2));
  supabase.rpc.mockResolvedValue({ data: resposta, error: null });
  await criar({ ...registro });
  expect(supabase.rpc.mock.calls[2][1]).toEqual(parametros);
  expect(parametros.p_dados.data).toBe('2026-09-19');
});

test('texto modificado após resultado incerto não é confundido com o texto confirmado', async () => {
  supabase.rpc.mockRejectedValue(new Error('offline'));
  await expect(criar()).rejects.toMatchObject({ code: 'RESULTADO_INCERTO' });
  supabase.rpc.mockResolvedValue({ data: resposta, error: null });
  await expect(criar({ ...registro, conteudo: 'Nova edição' })).rejects.toMatchObject({
    code: 'OPERACAO_RECUPERADA', registroConfirmado: { id: 'novo-id', conteudo: 'Texto clínico' },
  });
  expect(supabase.rpc.mock.calls[2][1]).toEqual(supabase.rpc.mock.calls[0][1]);
});

test('duplo clique compartilha a mesma operação em andamento', async () => {
  let resolver;
  supabase.rpc.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  const primeira = criar();
  const segunda = criar();
  resolver({ data: resposta, error: null });
  expect((await primeira).id).toBe((await segunda).id);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

test('não envia identidade nem horário de assinatura vindos do navegador', async () => {
  await criar({ ...registro, assinadoPorNome: 'Falso', assinadoPorRegistro: 'Falso' });
  const payload = supabase.rpc.mock.calls[0][1].p_dados;
  expect(payload).not.toHaveProperty('created_by');
  expect(payload).not.toHaveProperty('assinado_em');
  expect(payload).not.toHaveProperty('assinado_por_nome');
  expect(payload).not.toHaveProperty('assinado_por_registro');
});

test('salvar e assinar envia versão, conteúdo e assinatura na mesma RPC', async () => {
  await registrosService.atualizar('r1', { pacienteId: paciente.id, versao: 3, titulo: 'Consulta', conteudo: 'Texto final' }, 'user-1', true);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc.mock.calls[0][1]).toMatchObject({ p_acao: 'assinar', p_registro_id: 'r1', p_versao_esperada: 3, p_dados: { titulo: 'Consulta', conteudo: 'Texto final' } });
});

test('conflito não busca versão atual para sobrescrever automaticamente', async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { code: 'P4090', message: 'Conflito' } });
  await expect(registrosService.atualizar('r1', { pacienteId: paciente.id, versao: 2, conteudo: 'Minha edição' }, 'user-1')).rejects.toMatchObject({ code: 'P4090' });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

test('rascunho sem versão não é sobrescrito usando uma versão inventada', async () => {
  await expect(registrosService.atualizar('r1', { pacienteId: paciente.id, conteudo: 'Minha edição' }, 'user-1')).rejects.toThrow('Reabra o rascunho');
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test('não envia a gravação se não puder preservar seu identificador', async () => {
  const gravar = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  try {
    await expect(criar()).rejects.toThrow('gravação segura');
    expect(supabase.rpc).not.toHaveBeenCalled();
  } finally { gravar.mockRestore(); }
});

test('recibo antigo e repetição não duplicam nem rebaixam uma versão já carregada', () => {
  const setPacientes = jest.fn();
  const estado = [{ ...paciente, registros: [{ id: 'r1', versao: 3, conteudo: 'Atual' }] }];
  aplicarRegistroConfirmado(setPacientes, paciente.id, { id: 'r1', versao: 2, conteudo: 'Antigo' });
  expect(setPacientes.mock.calls[0][0](estado)).toEqual(estado);
});

test.each(['criar', 'retificar'])('%s mantém data e hora locais depois das 21h', async (operacao) => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date(2026, 11, 31, 23, 30));
  if (operacao === 'criar') await criar();
  else await registrosService.retificar({ original: { ...registro, id: 'original' }, conteudo: 'Correção', motivo: 'Ajuste' }, paciente.id, 'user-1');
  expect(supabase.rpc.mock.calls[0][1].p_dados).toMatchObject({ data: '2026-12-31', hora: '23:30' });
});


test('mantém a identidade até a tela confirmar que incorporou o resultado', async () => {
  const salvo = await criar();
  expect(sessionStorage.length).toBe(1);
  await criar();
  expect(supabase.rpc.mock.calls[0][1]).toEqual(supabase.rpc.mock.calls[1][1]);
  confirmarRecebimentoRegistro(salvo);
  expect(sessionStorage.length).toBe(0);
});

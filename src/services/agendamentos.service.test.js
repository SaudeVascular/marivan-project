import { supabase, resetSupabaseMockPadrao, criarQueryBuilder } from './supabase';
import { agendamentosService } from './agendamentos.service';

jest.mock('./supabase');
beforeEach(() => { resetSupabaseMockPadrao(); sessionStorage.clear(); });

test('criação repetida após resposta perdida usa a mesma operação e devolve o agendamento criado', async () => {
  const operacoes = [];
  let recuperou = false;
  supabase.from.mockImplementation(() => {
    const b = criarQueryBuilder();
    b.insert = (linhas) => {
      operacoes.push(linhas[0].operacao_id);
      b.single = () => (operacoes.length === 1
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "agendamentos_operacao_id_key"' } }));
      return b;
    };
    b.maybeSingle = () => { recuperou = true; return Promise.resolve({ data: { id: 'ag-1', data: '2030-02-01', hora: '09:00', status: 'Agendado', versao: 1 }, error: null }); };
    return b;
  });
  const ag = await agendamentosService.criar({ pacienteId: 'p1', data: '2030-02-01', hora: '09:00' }, 'u1');
  expect(operacoes).toHaveLength(2);
  expect(operacoes[1]).toBe(operacoes[0]);
  expect(recuperou).toBe(true);
  expect(ag).toEqual(expect.objectContaining({ id: 'ag-1', versao: 1, recuperado: false }));
});

test('mudar status com versão antiga: conflito em vez de sobrescrever', async () => {
  const b = criarQueryBuilder({ single: { data: null, error: null } });
  const eq = [];
  b.eq = (...a) => { eq.push(a); return b; };
  supabase.from.mockReturnValue(b);
  await expect(agendamentosService.atualizarStatus('ag-1', 'Confirmado', 2)).rejects.toMatchObject({ code: 'P4090' });
  expect(eq).toEqual([['id', 'ag-1'], ['versao', 2]]);
});

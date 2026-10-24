import { supabase, resetSupabaseMockPadrao, criarQueryBuilder } from './supabase';
import { cobrancasService } from './cobrancas.service';

jest.mock('./supabase');
beforeEach(() => resetSupabaseMockPadrao());

test('lista paginada pelo range, com total exato', async () => {
  const range = jest.fn();
  const gte = jest.fn();
  const resultado = { data: [{ id: 'c1', valor: 10, status: 'Pago' }], error: null, count: 250 };
  const builder = criarQueryBuilder(resultado);
  builder.range = (...a) => { range(...a); return builder; };
  builder.gte = (...a) => { gte(...a); return builder; };
  supabase.from.mockReturnValue(builder);

  const r = await cobrancasService.listar({ de: '2030-01-01', limite: 100, offset: 100 });
  expect(range).toHaveBeenCalledWith(100, 199);
  expect(gte).toHaveBeenCalledWith('data_cobranca', '2030-01-01');
  expect(r.total).toBe(250);
  expect(r.itens).toHaveLength(1);
});

test('totais vêm da função do banco, com os mesmos filtros', async () => {
  supabase.rpc.mockResolvedValue({ data: [{ quantidade: 1502, total: '15007.00', total_repasse: '7500.00' }], error: null });
  const r = await cobrancasService.resumo({ de: '2030-01-01', ate: '2030-01-31', medicoId: 'm1' });
  expect(supabase.rpc).toHaveBeenCalledWith('resumo_cobrancas', { p_de: '2030-01-01', p_ate: '2030-01-31', p_medico_id: 'm1' });
  expect(r).toEqual({ quantidade: 1502, total: 15007, totalRepasse: 7500 });
});

test('erro nos totais é propagado (a tela não mostra zero como se fosse real)', async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: new Error('sem permissão') });
  await expect(cobrancasService.resumo({})).rejects.toThrow('sem permissão');
});

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

describe('alteração com versão (migração 47)', () => {
  function builderUpdate(resultado) {
    const chamadas = { update: null, eq: [] };
    const b = criarQueryBuilder({ single: resultado });
    b.update = (campos) => { chamadas.update = campos; return b; };
    b.eq = (...a) => { chamadas.eq.push(a); return b; };
    supabase.from.mockReturnValue(b);
    return chamadas;
  }

  test('marca pago só na versão da tela e não manda data (é do banco)', async () => {
    const chamadas = builderUpdate({ data: { id: 'c1', status: 'Pago', versao: 4, data_pagamento: '2026-10-25' }, error: null });
    const r = await cobrancasService.atualizarStatus('c1', 'Pago', 3);
    expect(chamadas.update).toEqual({ status: 'Pago' });
    expect(chamadas.eq).toEqual([['id', 'c1'], ['versao', 3]]);
    expect(r.versao).toBe(4);
  });

  test('outra pessoa alterou antes: conflito, nada sobrescrito', async () => {
    builderUpdate({ data: null, error: null });
    await expect(cobrancasService.atualizarStatus('c1', 'Pago', 3)).rejects.toMatchObject({ code: 'P4090' });
  });

  test('sem versão nem tenta', async () => {
    await expect(cobrancasService.atualizarStatus('c1', 'Pago', undefined)).rejects.toThrow('Recarregue a lista');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

import { supabase, resetSupabaseMockPadrao } from './supabase';
import { acessosService, registrarImpressao } from './acessos.service';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('registra pela função do banco, sem informar o autor', async () => {
  supabase.rpc.mockResolvedValue({ error: null });
  await registrarImpressao('p1', 'Receituário');
  expect(supabase.rpc).toHaveBeenCalledWith('registrar_acesso', {
    p_paciente_id: 'p1', p_acao: 'imprimir_documento', p_detalhe: 'Receituário', p_registro_id: null,
  });
});

test('falha no registro nunca interrompe quem está atendendo', async () => {
  sessionStorage.clear();
  supabase.rpc.mockResolvedValueOnce({ error: { code: '42501', message: 'inativo' } });
  await expect(acessosService.registrar('p1', 'imprimir_documento')).resolves.toBe(false);
  expect(console.error).toHaveBeenCalledWith('Falha ao registrar acesso:', '42501', 'inativo');
  expect(sessionStorage.getItem('pep_acessos_pendentes')).toBeNull(); // recusa do banco não é reenviada
});

test('falha de rede: o registro fica na fila e é reenviado no próximo sucesso, com o horário original', async () => {
  sessionStorage.clear();
  supabase.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(registrarImpressao('p1', 'Receituário')).resolves.toBe(false);
  const fila = JSON.parse(sessionStorage.getItem('pep_acessos_pendentes'));
  expect(fila).toHaveLength(1);
  expect(JSON.stringify(fila)).not.toMatch(/conteudo|nome/);

  supabase.rpc.mockResolvedValue({ error: null });
  await expect(registrarImpressao('p2', 'Laudo')).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenLastCalledWith('registrar_acesso', expect.objectContaining({
    p_paciente_id: 'p1', p_acao: 'imprimir_documento', p_detalhe: expect.stringContaining('registrado com atraso'),
  }));
  expect(JSON.parse(sessionStorage.getItem('pep_acessos_pendentes'))).toEqual([]);
});

test('sem paciente não chama o banco', async () => {
  await acessosService.registrar(null, 'abrir_prontuario');
  expect(supabase.rpc).not.toHaveBeenCalled();
});

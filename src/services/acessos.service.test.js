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
  supabase.rpc.mockResolvedValueOnce({ error: { code: '42501', message: 'inativo' } });
  await expect(acessosService.registrar('p1', 'abrir_prontuario')).resolves.toBeUndefined();
  supabase.rpc.mockRejectedValueOnce(new Error('offline'));
  await expect(acessosService.registrar('p1', 'abrir_prontuario')).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledWith('Falha ao registrar acesso:', '42501', 'inativo');
});

test('sem paciente não chama o banco', async () => {
  await acessosService.registrar(null, 'abrir_prontuario');
  expect(supabase.rpc).not.toHaveBeenCalled();
});

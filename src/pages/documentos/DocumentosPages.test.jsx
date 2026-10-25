import { modelosService } from '../../services/modelos.service';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReceituarioPage } from './DocumentosPages';
import { supabase, resetSupabaseMockPadrao } from '../../services/supabase';
import { criarPdfDocumento } from '../../utils/documentoPdf';
import { iniciarJanelaImpressao, concluirJanelaImpressao } from '../../utils/janelaImpressao';

jest.mock('../../services/supabase');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'medico-1' } }) }));
jest.mock('../../hooks/useMedicoPerfil', () => ({ useMedicoPerfil: () => ({ medico: 'Dra. Teste', crm: 'CRM 123/BA', especialidade: '', estado: 'pronto', pronto: true, recarregar: () => {} }) }));
jest.mock('../../hooks/useClinica', () => ({ useClinica: () => ({ clinica: {} }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({
  Header: () => null, LogoClinica: () => null,
  CabecalhoImpresso: () => null, RodapeImpresso: () => null,
}));
// Impressão vira PDF de verdade (pdfmake) em vez de window.print — ver
// utils/documentoPdf e utils/janelaImpressao. A janela precisa abrir
// ANTES de qualquer await (senão o navegador bloqueia como pop-up — bug
// real encontrado testando o app), por isso é um módulo à parte,
// mockado aqui também em vez de deixar rodar de verdade (jsdom não
// implementa window.open).
jest.mock('../../utils/documentoPdf', () => ({ criarPdfDocumento: jest.fn(), prepararLogoPep: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/janelaImpressao', () => ({
  iniciarJanelaImpressao: jest.fn(),
  concluirJanelaImpressao: jest.fn(),
}));

beforeEach(() => {
  resetSupabaseMockPadrao();
  sessionStorage.clear();
  // react-scripts liga resetMocks:true — a implementação de qualquer
  // jest.fn() é apagada antes de cada teste, então precisa ser rearmada
  // aqui (mesmo cuidado documentado no README do projeto para o mock do
  // Supabase).
  criarPdfDocumento.mockReturnValue('pdf-fictício');
  iniciarJanelaImpressao.mockReturnValue('janela-fictícia');
});

test('o prontuário preserva todos os campos da receita apresentados na impressão', async () => {
  supabase.rpc.mockResolvedValue({ data: { id: 'receita-1', status: 'Assinado', versao: 1 }, error: null });
  render(<MemoryRouter initialEntries={['/receituario/paciente-1']}>
    <Routes><Route path="/receituario/:id" element={<ReceituarioPage pacientes={[{ id: 'paciente-1', nome: 'Paciente Fictício' }]} setPacientes={jest.fn()} />} /></Routes>
  </MemoryRouter>);

  for (const [placeholder, value] of [
    ['Nome do medicamento *', 'Medicamento fictício'],
    ['Apresentação (ex: 50mg)', '50 mg'],
    ['Quantidade (ex: 2 caixas)', '2 caixas'],
    ['Administração (ex: via oral)', 'via oral'],
    ['Frequência (ex: 1x ao dia)', '1x ao dia'],
    ['Duração (ex: 30 dias)', '30 dias'],
    ['Instruções (ex: tomar após as refeições)', 'Orientação de teste'],
  ]) fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

  fireEvent.click(screen.getByRole('button', { name: /Salvar no Prontuário/ }));
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
  const conteudo = supabase.rpc.mock.calls[0][1].p_dados.conteudo;
  for (const campo of ['Medicamento fictício', '50 mg', '2 caixas', 'via oral', '1x ao dia', '30 dias', 'Orientação de teste', 'Dra. Teste', 'CRM 123/BA']) {
    expect(conteudo).toContain(campo);
  }
  await screen.findByText('✓ Salvo no histórico!');
});


test('imprimir sem ter salvo antes grava no prontuário automaticamente', async () => {
  supabase.rpc.mockResolvedValue({ data: { id: 'receita-1', status: 'Assinado', versao: 1 }, error: null });
  render(<MemoryRouter initialEntries={['/receituario/paciente-1']}>
    <Routes><Route path="/receituario/:id" element={<ReceituarioPage pacientes={[{ id: 'paciente-1', nome: 'Paciente Fictício' }]} setPacientes={jest.fn()} />} /></Routes>
  </MemoryRouter>);

  fireEvent.change(screen.getByPlaceholderText('Nome do medicamento *'), { target: { value: 'Medicamento fictício' } });
  fireEvent.click(screen.getByRole('button', { name: /🖨️ Imprimir/ }));

  expect(iniciarJanelaImpressao).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
  await screen.findByText('✓ Salvo no histórico!');
  await waitFor(() => expect(concluirJanelaImpressao).toHaveBeenCalledWith('janela-fictícia', 'pdf-fictício'));
});

test('imprimir depois de já ter salvo não grava o registro de novo', async () => {
  supabase.rpc.mockResolvedValue({ data: { id: 'receita-1', status: 'Assinado', versao: 1 }, error: null });
  render(<MemoryRouter initialEntries={['/receituario/paciente-1']}>
    <Routes><Route path="/receituario/:id" element={<ReceituarioPage pacientes={[{ id: 'paciente-1', nome: 'Paciente Fictício' }]} setPacientes={jest.fn()} />} /></Routes>
  </MemoryRouter>);

  fireEvent.change(screen.getByPlaceholderText('Nome do medicamento *'), { target: { value: 'Medicamento fictício' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar no Prontuário/ }));
  await screen.findByText('✓ Salvo no histórico!');

  fireEvent.click(screen.getByRole('button', { name: /🖨️ Imprimir/ }));
  await waitFor(() => expect(concluirJanelaImpressao).toHaveBeenCalledWith('janela-fictícia', 'pdf-fictício'));
  const chamadas = nome => supabase.rpc.mock.calls.filter(([fn]) => fn === nome);
  expect(chamadas('salvar_registro_clinico')).toHaveLength(1);
  // A impressão fica registrada na auditoria de leitura (migração 38).
  expect(chamadas('registrar_acesso')).toEqual([['registrar_acesso', expect.objectContaining({
    p_paciente_id: 'paciente-1', p_acao: 'imprimir_documento', p_detalhe: 'Receituário',
  })]]);
});

test('falha dos modelos de receita avisa o profissional', async () => {
  const listar = jest.spyOn(modelosService, 'listar').mockRejectedValue(new Error('rede'));
  const toast = jest.requireMock('../../components/common/Toast').useToast();
  toast.error.mockClear();
  try {
    render(<MemoryRouter initialEntries={['/receituario/paciente-1']}>
      <Routes><Route path="/receituario/:id" element={<ReceituarioPage pacientes={[{ id: 'paciente-1', nome: 'Paciente Fictício' }]} setPacientes={jest.fn()} />} /></Routes>
    </MemoryRouter>);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Não foi possível carregar os modelos')));
  } finally { listar.mockRestore(); }
});

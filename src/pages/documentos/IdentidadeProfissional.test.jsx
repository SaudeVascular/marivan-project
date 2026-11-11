import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AtestadoPage } from './DocumentosPages';
import { supabase, resetSupabaseMockPadrao } from '../../services/supabase';
import { usuariosService } from '../../services/usuarios.service';
import { iniciarJanelaImpressao } from '../../utils/janelaImpressao';

// useMedicoPerfil de verdade: a tela não pode salvar nem imprimir enquanto
// a identidade do profissional não chegou (ou falhou).
jest.mock('../../services/supabase');
jest.mock('../../services/usuarios.service');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'medico-1' }, funcaoClinicaEfetiva: 'Médico' }) }));
jest.mock('../../hooks/useClinica', () => ({ useClinica: () => ({ clinica: {} }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({
  Header: () => null, LogoClinica: () => null,
  CabecalhoImpresso: () => null, RodapeImpresso: () => null,
}));
jest.mock('../../utils/documentoPdf', () => ({ criarPdfDocumento: jest.fn(), prepararLogoPep: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/janelaImpressao', () => ({ iniciarJanelaImpressao: jest.fn(), concluirJanelaImpressao: jest.fn() }));

const PERFIL = { nome: 'Teste Fictícia', sexo: 'Feminino', crm: '123', uf: 'BA', funcao: 'Médico', ativo: true };

function tela() {
  return render(<MemoryRouter initialEntries={['/atestados/paciente-1']}>
    <Routes><Route path="/atestados/:id" element={<AtestadoPage pacientes={[{ id: 'paciente-1', nome: 'Paciente Fictício' }]} setPacientes={jest.fn()} />} /></Routes>
  </MemoryRouter>);
}
const botaoSalvar = () => screen.getByRole('button', { name: /Salvar no Prontuário/ });
const botaoImprimir = () => screen.getByRole('button', { name: /Imprimir/ });

beforeEach(() => {
  resetSupabaseMockPadrao();
  sessionStorage.clear();
});

test('enquanto a identidade carrega, salvar e imprimir ficam bloqueados', async () => {
  usuariosService.buscarPerfil.mockImplementation(() => new Promise(() => {}));
  tela();
  expect(await screen.findByText(/Carregando seus dados profissionais/)).toBeInTheDocument();
  expect(botaoSalvar()).toBeDisabled();
  expect(botaoImprimir()).toBeDisabled();
  fireEvent.click(botaoImprimir());
  expect(iniciarJanelaImpressao).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test('falha ao carregar: mostra o erro e libera depois de tentar novamente', async () => {
  usuariosService.buscarPerfil
    .mockRejectedValueOnce(new Error('Failed to fetch'))
    .mockResolvedValueOnce(PERFIL);
  tela();
  expect(await screen.findByText(/Não foi possível carregar seus dados profissionais/)).toBeInTheDocument();
  expect(botaoSalvar()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(botaoSalvar()).toBeEnabled());
  expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  expect(botaoImprimir()).toBeEnabled();
  expect(screen.getByText('Dra. Teste Fictícia')).toBeInTheDocument();
});

test('cadastro sem número do conselho: bloqueia e explica', async () => {
  usuariosService.buscarPerfil.mockResolvedValue({ ...PERFIL, crm: '' });
  tela();
  expect(await screen.findByText(/número do registro no conselho ou UF/)).toBeInTheDocument();
  expect(botaoSalvar()).toBeDisabled();
  expect(botaoImprimir()).toBeDisabled();
});

test('cadastro sem UF: bloqueia (mesma regra do banco ao assinar)', async () => {
  usuariosService.buscarPerfil.mockResolvedValue({ ...PERFIL, uf: '' });
  tela();
  expect(await screen.findByText(/número do registro no conselho ou UF/)).toBeInTheDocument();
  expect(botaoSalvar()).toBeDisabled();
});

test('identidade completa: libera salvar e imprimir', async () => {
  usuariosService.buscarPerfil.mockResolvedValue(PERFIL);
  tela();
  expect(await screen.findByText('CRM 123/BA')).toBeInTheDocument();
  expect(botaoSalvar()).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

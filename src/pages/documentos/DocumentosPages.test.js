import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReceituarioPage } from './DocumentosPages';
import { supabase, resetSupabaseMockPadrao } from '../../services/supabase';

jest.mock('../../services/supabase');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'medico-1' } }) }));
jest.mock('../../hooks/useMedicoPerfil', () => ({ useMedicoPerfil: () => ({ medico: 'Dra. Teste', crm: 'CRM 123/BA', especialidade: '' }) }));
jest.mock('../../components/common/Toast', () => ({ useToast: () => ({ error: jest.fn(), warning: jest.fn() }) }));
jest.mock('../../components/common/Layout', () => ({
  Header: () => null, LogoClinica: () => null,
  CabecalhoImpresso: () => null, RodapeImpresso: () => null,
}));

beforeEach(() => { resetSupabaseMockPadrao(); sessionStorage.clear(); });

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

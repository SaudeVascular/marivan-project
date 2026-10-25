import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ImprimirAtendimentoPage } from './DocumentosPages';
import { resetSupabaseMockPadrao } from '../../services/supabase';
import { registrosService } from '../../services/registros.service';
import { pacientesService } from '../../services/pacientes.service';

jest.mock('../../services/supabase');
jest.mock('../../services/registros.service');
jest.mock('../../services/pacientes.service');
jest.mock('../../hooks/useClinica', () => ({ useClinica: () => ({ clinica: {} }) }));
jest.mock('../../components/common/Layout', () => ({
  Header: () => null, LogoClinica: () => null,
  CabecalhoImpresso: ({ paciente }) => <p>Cabeçalho de {paciente.nome}</p>, RodapeImpresso: () => null,
}));

const REGISTRO_A = { id: 'reg-A', pacienteId: 'pac-A', tipo: 'Atestado', titulo: 'Atestado', conteudo: 'Conteúdo clínico de A', data: '24/10/2026', hora: '10:00', status: 'Assinado' };

function tela(pacienteId, registroId) {
  return render(<MemoryRouter initialEntries={[`/imprimir/${pacienteId}/${registroId}`]}>
    <Routes><Route path="/imprimir/:pacienteId/:registroId" element={<ImprimirAtendimentoPage />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => resetSupabaseMockPadrao());

test('URL com o paciente B e um registro de A não mostra nada de nenhum dos dois', async () => {
  registrosService.buscarDoPaciente.mockResolvedValue(null); // o banco não acha reg-A para pac-B
  pacientesService.buscarPorId.mockResolvedValue({ id: 'pac-B', nome: 'Paciente B' });
  tela('pac-B', 'reg-A');
  expect(await screen.findByRole('alert')).toHaveTextContent('Registro não encontrado para este paciente');
  expect(registrosService.buscarDoPaciente).toHaveBeenCalledWith('reg-A', 'pac-B');
  expect(screen.queryByText(/Conteúdo clínico de A/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Paciente B/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Imprimir/ })).not.toBeInTheDocument();
});

test('o paciente exibido é o do próprio registro', async () => {
  registrosService.buscarDoPaciente.mockResolvedValue(REGISTRO_A);
  pacientesService.buscarPorId.mockResolvedValue({ id: 'pac-A', nome: 'Paciente A' });
  tela('pac-A', 'reg-A');
  expect(await screen.findByText('Cabeçalho de Paciente A')).toBeInTheDocument();
  expect(pacientesService.buscarPorId).toHaveBeenCalledWith('pac-A');
  expect(screen.getByText('Conteúdo clínico de A')).toBeInTheDocument();
});

test('se o paciente devolvido não for o do registro, recusa', async () => {
  registrosService.buscarDoPaciente.mockResolvedValue(REGISTRO_A);
  pacientesService.buscarPorId.mockResolvedValue({ id: 'pac-B', nome: 'Paciente B' });
  tela('pac-A', 'reg-A');
  expect(await screen.findByRole('alert')).toHaveTextContent('Registro não encontrado para este paciente');
  expect(screen.queryByText(/Conteúdo clínico de A/)).not.toBeInTheDocument();
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConteudoDaSessao } from './App';
import { useAuth } from './hooks/useAuth';
import { pacientesService } from './services/pacientes.service';

jest.mock('./services/supabase');
jest.mock('./hooks/useAuth');
jest.mock('./services/pacientes.service');
jest.mock('./components/guards', () => {
  const guard = ({ children }) => children;
  return { ProtectedLayout: guard, SomenteAdmin: guard, SomenteClinico: guard, SomenteMedico: guard, SomenteFinanceiro: guard, SomenteFinanceiroOuMedico: guard, SomenteRecepcao: guard, SomenteEnfermagem: guard };
});
jest.mock('./pages/pacientes/PacientesPage', () => ({ PacientesPage: ({ pacientes }) => <div>{pacientes.map(p => <p key={p.id}>{p.nome}</p>)}</div> }));

function tela() {
  return <MemoryRouter initialEntries={['/pacientes']}><ConteudoDaSessao /></MemoryRouter>;
}

beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'usuario-A' }, funcao: 'Médico' });
});

test('remove imediatamente dados do usuário anterior e ignora resposta tardia da sessão antiga', async () => {
  let resolverA;
  let resolverB;
  pacientesService.listar
    .mockImplementationOnce(() => new Promise(resolve => { resolverA = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolverB = resolve; }));
  const { rerender } = render(tela());
  useAuth.mockReturnValue({ user: { id: 'usuario-B' }, funcao: 'Recepcionista' });
  rerender(tela());
  await act(async () => { resolverB([{ id: 'p2', nome: 'Dados B' }]); });
  expect(screen.getByText('Dados B')).toBeInTheDocument();
  await act(async () => { resolverA([{ id: 'p1', nome: 'Dados A' }]); });
  expect(screen.queryByText('Dados A')).not.toBeInTheDocument();
  expect(screen.getByText('Dados B')).toBeInTheDocument();
});

test('cache já carregado não sobrevive à troca de identidade', async () => {
  pacientesService.listar.mockResolvedValueOnce([{ id: 'p1', nome: 'Dados A' }]).mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = render(tela());
  await screen.findByText('Dados A');
  useAuth.mockReturnValue({ user: { id: 'usuario-B' }, funcao: 'Médico' });
  rerender(tela());
  expect(screen.queryByText('Dados A')).not.toBeInTheDocument();
  expect(screen.getByText('Carregando pacientes...')).toBeInTheDocument();
});

test('falha de carregamento mostra erro e permite tentar novamente', async () => {
  pacientesService.listar.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ id: 'p1', nome: 'Paciente recuperado' }]);
  render(tela());
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Paciente recuperado');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

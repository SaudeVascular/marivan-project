import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConteudoDaSessao } from './App';
import { useAuth } from './hooks/useAuth';
import { pacientesService } from './services/pacientes.service';
import { useBuscaPacientes, usePacientesCache } from './hooks/usePacientesCache';

jest.mock('./services/supabase');
jest.mock('./hooks/useAuth');
jest.mock('./services/pacientes.service');
jest.mock('./components/guards', () => {
  const guard = ({ children }) => children;
  return { ProtectedLayout: guard, SomenteAdmin: guard, SomenteClinico: guard, SomenteMedico: guard, SomenteFinanceiro: guard, SomenteFinanceiroOuMedico: guard, SomenteRecepcao: guard, SomenteEnfermagem: guard, SomenteQuemEmite: guard };
});
// Tela de Pacientes mínima: busca pela mesma via da tela real e mostra
// também o que está no cache da sessão.
function MockPacientesFicticia() {
  const { itens } = useBuscaPacientes('', { listarSemTermo: true });
  const cache = usePacientesCache();
  return (
    <div>
      {itens.map(p => <p key={p.id}>{p.nome}</p>)}
      <span data-testid="cache">{cache.pacientes.map(p => p.nome).join('|')}</span>
    </div>
  );
}
jest.mock('./pages/pacientes/PacientesPage', () => ({ PacientesPage: () => <MockPacientesFicticia /> }));

function tela() {
  return <MemoryRouter initialEntries={['/pacientes']}><ConteudoDaSessao /></MemoryRouter>;
}

beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'usuario-A' }, funcao: 'Médico' });
});

test('não bloqueia a abertura carregando todos os pacientes', () => {
  pacientesService.buscar.mockImplementation(() => new Promise(() => {}));
  render(tela());
  expect(screen.queryByText('Carregando pacientes...')).not.toBeInTheDocument();
  expect(pacientesService.listar).toBeUndefined();
});

test('resposta tardia da sessão anterior não aparece para o novo usuário', async () => {
  let resolverA;
  let resolverB;
  pacientesService.buscar
    .mockImplementationOnce(() => new Promise(resolve => { resolverA = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolverB = resolve; }));
  const { rerender } = render(tela());
  await act(async () => { await new Promise(r => setTimeout(r, 350)); });
  useAuth.mockReturnValue({ user: { id: 'usuario-B' }, funcao: 'Recepcionista' });
  rerender(tela());
  await act(async () => { await new Promise(r => setTimeout(r, 350)); });
  await act(async () => { resolverB({ itens: [{ id: 'p2', nome: 'Dados B' }], total: 1 }); });
  expect(await screen.findByText('Dados B', { selector: 'p' })).toBeInTheDocument();
  await act(async () => { resolverA({ itens: [{ id: 'p1', nome: 'Dados A' }], total: 1 }); });
  expect(screen.queryByText('Dados A', { selector: 'p' })).not.toBeInTheDocument();
  expect(screen.getByTestId('cache').textContent).toBe('Dados B');
});

test('cache já carregado não sobrevive à troca de identidade', async () => {
  pacientesService.buscar
    .mockResolvedValueOnce({ itens: [{ id: 'p1', nome: 'Dados A' }], total: 1 })
    .mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = render(tela());
  await screen.findByText('Dados A', { selector: 'p' });
  expect(screen.getByTestId('cache').textContent).toBe('Dados A');
  useAuth.mockReturnValue({ user: { id: 'usuario-B' }, funcao: 'Médico' });
  rerender(tela());
  expect(screen.queryByText('Dados A', { selector: 'p' })).not.toBeInTheDocument();
  expect(screen.getByTestId('cache').textContent).toBe('');
});

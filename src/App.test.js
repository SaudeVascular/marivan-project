import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
// Importar daqui (não de services/__mocks__/supabase direto) importa —
// jest.mock troca este caminho pelo mock para todo mundo, mas um import
// direto do arquivo em __mocks__ cria uma SEGUNDA cópia do objeto,
// diferente da que useAuth.js recebe (cada import "cru" reavalia o
// módulo). Só assim resetSupabaseMockPadrao mexe no mesmo objeto que o
// app usa de verdade.
import { resetSupabaseMockPadrao } from './services/supabase';

// Sem o mock, o App real chama supabase.auth.getSession() (rede de
// verdade) no mount, que resolve depois do render() retornar — daí o
// aviso "not wrapped in act(...)" e um teste que depende de rede.
jest.mock('./services/supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
  window.history.pushState({}, '', '/');
});

test('renderiza a tela de login quando não há sessão', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText('Prontuário Eletrônico')).toBeInTheDocument();
  });
});

test('mantém a página de nova senha acessível enquanto o token de recuperação é processado', async () => {
  window.history.pushState({}, '', '/redefinir-senha');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Definir nova senha' })).toBeInTheDocument();
  });
  expect(window.location.pathname).toBe('/redefinir-senha');
});

test('mantém a ativação de conta acessível sem passar pelo login comum', async () => {
  window.history.pushState({}, '', '/ativar-conta');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Ativar minha conta' })).toBeInTheDocument();
  });
  expect(window.location.pathname).toBe('/ativar-conta');
});

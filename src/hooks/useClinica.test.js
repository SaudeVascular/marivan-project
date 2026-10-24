import { fireEvent, render, screen } from '@testing-library/react';
import { ClinicaProvider, useClinica } from './useClinica';
import { configuracoesService } from '../services/configuracoes.service';
import { useAuth } from './useAuth';

jest.mock('../services/configuracoes.service');
jest.mock('./useAuth');

function Dados() {
  const { clinica } = useClinica();
  return <div>{clinica.nome}</div>;
}

// Bug real encontrado testando o app: sem sessão (ex.: tela de login, ou
// sessão ainda sendo restaurada), a busca sempre recusa com 42501 —
// nenhum perfil não autenticado tem SELECT em configuracoes_clinica.
// Buscar de qualquer forma nesse momento mostrava "Não foi possível
// carregar..." mesmo antes do usuário logar, e o aviso nunca sumia
// sozinho depois de um login bem-sucedido, porque a busca só rodava uma
// vez, na montagem — reagir a `user` corrige as duas pontas.
describe('ClinicaProvider — só busca com sessão autenticada', () => {
  test('sem sessão, não busca nem mostra erro', () => {
    useAuth.mockReturnValue({ user: null });
    render(<ClinicaProvider><Dados /></ClinicaProvider>);
    expect(configuracoesService.buscar).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('falha de configuração fica visível e uma nova tentativa pode recuperar os dados', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } });
    configuracoesService.buscar.mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce({ nome: 'Clínica fictícia' });
    render(<ClinicaProvider><Dados /></ClinicaProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados da clínica');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Clínica fictícia');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('login depois de montar sem sessão dispara a busca automaticamente', async () => {
    useAuth.mockReturnValue({ user: null });
    configuracoesService.buscar.mockResolvedValue({ nome: 'Clínica após login' });
    const { rerender } = render(<ClinicaProvider><Dados /></ClinicaProvider>);
    expect(configuracoesService.buscar).not.toHaveBeenCalled();

    useAuth.mockReturnValue({ user: { id: 'u1' } });
    rerender(<ClinicaProvider><Dados /></ClinicaProvider>);
    await screen.findByText('Clínica após login');
  });
});

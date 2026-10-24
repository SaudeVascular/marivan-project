import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MinhaContaPage } from './MinhaContaPage';
import { usuariosService } from '../../services/usuarios.service';

jest.mock('../../services/usuarios.service');
jest.mock('../../services/authService');
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), success: jest.fn(), warning: jest.fn() };
  return { useToast: () => toast };
});
const mockUseAuth = jest.fn();
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

beforeEach(() => { jest.clearAllMocks(); });

test('perfil sem acesso clínico não vê a seção de assinatura', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, perfil: {}, temAcessoClinico: false });
  render(<MemoryRouter><MinhaContaPage /></MemoryRouter>);
  expect(screen.queryByText('Assinatura digitalizada')).not.toBeInTheDocument();
});

test('médico vê a seção e consegue salvar uma assinatura enviada por arquivo', async () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, perfil: { assinatura_imagem: null }, temAcessoClinico: true });
  usuariosService.salvarAssinatura.mockResolvedValue();
  const toast = jest.requireMock('../../components/common/Toast').useToast();

  render(<MemoryRouter><MinhaContaPage /></MemoryRouter>);
  expect(screen.getByText('Assinatura digitalizada')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Enviar imagem/ }));
  const arquivo = new File(['conteudo-fictício'], 'assinatura.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Arquivo da assinatura'), { target: { files: [arquivo] } });

  await screen.findByAltText('Pré-visualização da assinatura enviada');
  fireEvent.click(screen.getByRole('button', { name: /Salvar assinatura/ }));

  await waitFor(() => expect(usuariosService.salvarAssinatura).toHaveBeenCalledWith('u1', expect.stringContaining('data:')));
  expect(toast.success).toHaveBeenCalled();
});

test('remover assinatura existente chama o serviço', async () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, perfil: { assinatura_imagem: 'data:image/png;base64,abc' }, temAcessoClinico: true });
  usuariosService.removerAssinatura.mockResolvedValue();

  render(<MemoryRouter><MinhaContaPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Remover assinatura/ }));
  await waitFor(() => expect(usuariosService.removerAssinatura).toHaveBeenCalledWith('u1'));
});

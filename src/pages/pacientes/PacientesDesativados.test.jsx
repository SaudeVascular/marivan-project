import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PacientesDesativados } from './PacientesDesativados';
import { pacientesService } from '../../services/pacientes.service';

jest.mock('../../services/supabase');
jest.mock('../../services/pacientes.service');
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});

test('localiza desativados e reativa', async () => {
  pacientesService.buscar.mockResolvedValue({ itens: [{ id: 'p1', nome: 'Paciente Desativado', cpf: '529.982.247-25' }], total: 1 });
  pacientesService.reativar.mockResolvedValue();
  const aoReativar = jest.fn();
  render(<PacientesDesativados aoReativar={aoReativar} />);
  expect(pacientesService.buscar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Pacientes desativados/ }));
  expect(await screen.findByText('Paciente Desativado')).toBeInTheDocument();
  expect(pacientesService.buscar).toHaveBeenCalledWith(expect.objectContaining({ ativos: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));
  await waitFor(() => expect(pacientesService.reativar).toHaveBeenCalledWith('p1'));
  await waitFor(() => expect(screen.queryByText('Paciente Desativado')).not.toBeInTheDocument());
  expect(aoReativar).toHaveBeenCalled();
});

test('falha ao buscar desativados é mostrada como erro, não como lista vazia', async () => {
  pacientesService.buscar.mockRejectedValue(new Error('offline'));
  render(<PacientesDesativados />);
  fireEvent.click(screen.getByRole('button', { name: /Pacientes desativados/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os desativados');
  expect(screen.queryByText('Nenhum paciente desativado encontrado.')).not.toBeInTheDocument();
});

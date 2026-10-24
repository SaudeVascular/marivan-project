import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PacientesPage } from './PacientesPage';
import { pacientesService } from '../../services/pacientes.service';
import { PacientesCacheContext } from '../../hooks/usePacientesCache';

jest.mock('../../services/supabase');
jest.mock('../../services/pacientes.service', () => ({
  ...jest.requireActual('../../services/pacientes.service'),
  pacientesService: { buscar: jest.fn(), buscarPorId: jest.fn(), atualizarCadastro: jest.fn(), criar: jest.fn(), deletar: jest.fn() },
}));
jest.mock('../../services/convenios.service', () => ({ conveniosService: { listar: () => Promise.resolve([]) } }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ temAcessoClinico: true }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));

const maria = { id: 'p1', nome: 'Maria Fictícia', telefone: '(71) 1111-1111', cpf: '111.111.111-11', versaoCadastro: 2, registros: [] };

function Tela() {
  const [pacientes, setPacientes] = React.useState([]);
  const valor = React.useMemo(() => ({ pacientes, setPacientes }), [pacientes]);
  return <MemoryRouter><PacientesCacheContext.Provider value={valor}><PacientesPage setPacientes={setPacientes} /></PacientesCacheContext.Provider></MemoryRouter>;
}

beforeEach(() => { window.scrollTo = jest.fn(); });

test('cadastro alterado por outra pessoa: avisa, não sobrescreve e permite usar os dados atuais', async () => {
  pacientesService.buscar.mockResolvedValue({ itens: [maria], total: 1 });
  pacientesService.atualizarCadastro.mockRejectedValueOnce(Object.assign(new Error('alterado'), { code: 'P4090' }));
  pacientesService.buscarPorId.mockResolvedValue({ ...maria, telefone: '(71) 2222-2222', versaoCadastro: 3 });

  render(<Tela />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Cadastro' }));
  const telefone = screen.getByDisplayValue('(71) 1111-1111');
  fireEvent.change(telefone, { target: { value: '(71) 9999-9999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

  expect(await screen.findByText(/Outra pessoa alterou este cadastro/)).toBeInTheDocument();
  expect(pacientesService.atualizarCadastro).toHaveBeenCalledWith('p1', expect.anything(), 2);
  expect(screen.getByRole('button', { name: 'Salvar Alterações' })).toBeDisabled();
  expect(screen.getByText(/Agora no cadastro: Maria Fictícia · \(71\) 2222-2222/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Usar os dados atuais' }));
  expect(await screen.findByDisplayValue('(71) 2222-2222')).toBeInTheDocument();
  expect(screen.queryByText(/Outra pessoa alterou este cadastro/)).not.toBeInTheDocument();
});

test('desativar envia a versão do cadastro que estava na lista', async () => {
  pacientesService.buscar.mockResolvedValue({ itens: [maria], total: 1 });
  pacientesService.deletar.mockResolvedValue();
  window.confirm = jest.fn(() => true);
  render(<Tela />);
  fireEvent.click(await screen.findByRole('button', { name: /Desativar/ }));
  await waitFor(() => expect(pacientesService.deletar).toHaveBeenCalledWith('p1', 2));
});

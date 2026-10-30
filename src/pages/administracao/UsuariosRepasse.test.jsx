import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsuariosPage } from './AdministracaoPages';
import { usuariosService } from '../../services/usuarios.service';
import { repasseService } from '../../services/repasse.service';
import { useToast } from '../../components/common/Toast';

jest.mock('../../services/supabase');
jest.mock('../../services/usuarios.service', () => ({ usuariosService: { listar: jest.fn(), atualizar: jest.fn() } }));
jest.mock('../../services/repasse.service', () => ({ repasseService: { listar: jest.fn(), salvar: jest.fn() } }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'adm' }, funcao: 'Administrador' }) }));
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});

beforeEach(() => {
  usuariosService.listar.mockResolvedValue([
    { id: 'med-1', nome: 'Dra. Ana', email: 'ana@example.invalid', funcao: 'Médico', ativo: true, crm: '123', uf: 'BA' },
    { id: 'psi-1', nome: 'Psi. Caio', email: 'caio@example.invalid', funcao: 'Psicólogo(a)', ativo: true },
    { id: 'rec-1', nome: 'Rita', email: 'rita@example.invalid', funcao: 'Recepcionista', ativo: true },
  ]);
  repasseService.listar.mockResolvedValue([{ profissionalId: 'med-1', consulta: 60, exame: 10, procedimento: 30 }]);
  usuariosService.atualizar.mockResolvedValue();
  repasseService.salvar.mockImplementation((id, r) => Promise.resolve({ profissionalId: id, consulta: Number(r.consulta), exame: Number(r.exame), procedimento: Number(r.procedimento) }));
});

const tela = () => render(<MemoryRouter><UsuariosPage /></MemoryRouter>);

test('cada profissional tem as próprias regras; quem não atende não tem repasse', async () => {
  tela();
  expect(await screen.findByText('Repasse: consultas 60% · exames 10% · procedimentos 30%')).toBeInTheDocument();
  expect(screen.getByText('Repasse: não definido (0%)')).toBeInTheDocument(); // psicólogo
  expect(screen.getAllByText(/^Repasse:/)).toHaveLength(2); // a recepcionista não aparece
});

test('editar o repasse grava só a regra daquele profissional, separada do perfil', async () => {
  tela();
  await screen.findByText(/consultas 60%/);
  fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[0]);
  fireEvent.change(screen.getByLabelText('Exames (%)'), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  await waitFor(() => expect(repasseService.salvar).toHaveBeenCalledWith('med-1', { consulta: 60, exame: '15', procedimento: 30 }));
  expect(usuariosService.atualizar).toHaveBeenCalledWith('med-1', expect.not.objectContaining({ repasse: expect.anything() }));
  expect(await screen.findByText('Repasse: consultas 60% · exames 15% · procedimentos 30%')).toBeInTheDocument();
});

test('percentual fora de 0–100 não é enviado; sem mudança no repasse, só o perfil é salvo', async () => {
  tela();
  await screen.findByText(/consultas 60%/);
  fireEvent.click(screen.getAllByRole('button', { name: /Editar/ })[1]); // psicólogo
  fireEvent.change(screen.getByLabelText('Procedimentos (%)'), { target: { value: '120' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  expect(useToast().warning).toHaveBeenCalledWith('Os percentuais de repasse vão de 0 a 100.');
  expect(usuariosService.atualizar).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Procedimentos (%)'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  await waitFor(() => expect(usuariosService.atualizar).toHaveBeenCalled());
  expect(repasseService.salvar).not.toHaveBeenCalled();
});

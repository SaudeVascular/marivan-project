import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProntuarioPage } from './ProntuarioPage';
import { registrosService } from '../../services/registros.service';
import { resetSupabaseMockPadrao } from '../../services/supabase';

jest.mock('../../services/supabase');
jest.mock('../../services/registros.service');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'medico-1' }, funcao: 'Médico' }) }));
jest.mock('../../components/common/Toast', () => ({ useToast: () => ({ error: jest.fn(), warning: jest.fn() }) }));
jest.mock('../../components/common/Layout', () => ({ Header: () => null, painelStyle: {}, atalhoStyle: {} }));

function Tela() {
  const [pacientes, setPacientes] = React.useState([{ id: 'p1', nome: 'Paciente Fictício', registros: [] }]);
  return <MemoryRouter initialEntries={['/prontuario/p1']}><Routes>
    <Route path="/prontuario/:id" element={<ProntuarioPage pacientes={pacientes} setPacientes={setPacientes} />} />
  </Routes></MemoryRouter>;
}

beforeEach(() => {
  resetSupabaseMockPadrao();
  localStorage.clear();
  sessionStorage.clear();
});

test('erro de rede não aparece como histórico vazio e permite recarregar', async () => {
  registrosService.listarPorPaciente.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<Tela />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o histórico');
  expect(screen.queryByText('Nenhum registro ainda.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
  await screen.findByText('Nenhum registro ainda.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('falha no armazenamento da aba não transforma gravação confirmada no servidor em erro', async () => {
  registrosService.listarPorPaciente.mockResolvedValue([]);
  registrosService.criar.mockResolvedValue({ id: 'r1', tipo: 'Consulta', titulo: 'Consulta', conteudo: 'Texto', status: 'Rascunho', data: '19/09/2026' });
  render(<Tela />);
  await screen.findByText('Nenhum registro ainda.');
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  try {
    fireEvent.change(screen.getByPlaceholderText('História clínica, exame físico, hipótese diagnóstica, conduta...'), { target: { value: 'Texto' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar rascunho/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível atualizar o rascunho temporário'));
    expect(screen.queryByText(/Não foi possível confirmar a gravação/)).not.toBeInTheDocument();
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Rascunho salvo no prontuário, ainda não assinado/)).toBeInTheDocument();
  } finally {
    setItem.mockRestore();
  }
});

test('finalizar atendimento envia texto e versão em uma única gravação', async () => {
  const { salvarRascunhoAtendimento } = require('../../utils/rascunhoAtendimento');
  salvarRascunhoAtendimento('p1', 'Texto revisado', 'r1', 'medico-1', 2);
  registrosService.listarPorPaciente.mockResolvedValue([]);
  registrosService.atualizar.mockResolvedValue({ id: 'r1', status: 'Assinado', versao: 3 });
  render(<Tela />);
  await screen.findByText('Nenhum registro ainda.');
  fireEvent.click(screen.getByRole('button', { name: /Finalizar e Assinar/ }));
  await waitFor(() => expect(registrosService.atualizar).toHaveBeenCalledWith('r1', expect.objectContaining({ versao: 2, pacienteId: 'p1', conteudo: 'Texto revisado' }), 'medico-1', true));
  expect(registrosService.assinar).not.toHaveBeenCalled();
  expect(registrosService.criar).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByPlaceholderText('História clínica, exame físico, hipótese diagnóstica, conduta...')).toHaveValue(''));
});

test('conflito preserva texto e só adota outra versão depois da comparação explícita', async () => {
  const { salvarRascunhoAtendimento } = require('../../utils/rascunhoAtendimento');
  salvarRascunhoAtendimento('p1', 'Minha edição', 'r1', 'medico-1', 1);
  registrosService.listarPorPaciente.mockResolvedValue([]);
  registrosService.atualizar.mockRejectedValueOnce(Object.assign(new Error('Registro alterado em outra sessão'), { code: 'P4090' }));
  registrosService.buscarPorId.mockResolvedValue({ id: 'r1', pacienteId: 'p1', versao: 2, conteudo: 'Edição da outra aba', status: 'Rascunho' });
  render(<Tela />);
  await screen.findByText('Nenhum registro ainda.');
  fireEvent.click(screen.getByRole('button', { name: /Salvar rascunho/ }));
  await screen.findByText('Seu texto foi preservado. Compare com o registro atual antes de continuar.');
  const texto = screen.getByPlaceholderText('História clínica, exame físico, hipótese diagnóstica, conduta...');
  expect(texto).toHaveValue('Minha edição');
  expect(registrosService.buscarPorId).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar versão atual' }));
  await screen.findByText('Edição da outra aba');
  expect(texto).toHaveValue('Minha edição');
  expect(registrosService.atualizar).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Manter meu texto sobre esta versão' }));
  registrosService.atualizar.mockResolvedValue({ id: 'r1', pacienteId: 'p1', versao: 3, conteudo: 'Minha edição', status: 'Rascunho' });
  fireEvent.click(screen.getByRole('button', { name: /Salvar rascunho/ }));
  await waitFor(() => expect(registrosService.atualizar).toHaveBeenLastCalledWith('r1', expect.objectContaining({ versao: 2, conteudo: 'Minha edição' }), 'medico-1', false));
});

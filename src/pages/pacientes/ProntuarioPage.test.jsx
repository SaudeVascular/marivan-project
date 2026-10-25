import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProntuarioPage } from './ProntuarioPage';
import { registrosService } from '../../services/registros.service';
import { resetSupabaseMockPadrao } from '../../services/supabase';

jest.mock('../../services/supabase');
jest.mock('../../services/registros.service');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'medico-1' }, funcao: 'Médico' }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn() };
  return { useToast: () => toast };
});
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

describe('salvamento automático no prontuário', () => {
  const { act } = require('@testing-library/react');
  const caixa = () => screen.getByLabelText('Atendimento atual');
  const digitar = (texto) => fireEvent.change(caixa(), { target: { value: texto } });
  const avancar = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

  beforeEach(() => {
    jest.useFakeTimers();
    registrosService.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => { jest.useRealTimers(); });

  test('10 s sem digitar criam o rascunho; novas alterações atualizam a mesma versão', async () => {
    registrosService.criar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 1, conteudo: 'Primeira parte' });
    registrosService.atualizar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 2, conteudo: 'Primeira parte e mais' });
    render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');

    digitar('Primeira parte');
    await avancar(9000);
    expect(registrosService.criar).not.toHaveBeenCalled();
    await avancar(1000);
    await waitFor(() => expect(registrosService.criar).toHaveBeenCalledWith(
      expect.objectContaining({ conteudo: 'Primeira parte', status: 'Rascunho' }), 'p1', 'medico-1'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Salvo no prontuário às/));
    expect(caixa()).toBeEnabled();

    digitar('Primeira parte e mais');
    await avancar(10000);
    await waitFor(() => expect(registrosService.atualizar).toHaveBeenCalledWith('r1',
      expect.objectContaining({ conteudo: 'Primeira parte e mais', versao: 1 }), 'medico-1', false));
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
  });

  test('sem conexão avisa sem erro em vermelho e tenta de novo em 30 s', async () => {
    registrosService.criar
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({ id: 'r1', status: 'Rascunho', versao: 1, conteudo: 'Texto' });
    render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');

    digitar('Texto');
    await avancar(10000);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Sem conexão com o servidor/));
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();

    await avancar(30000);
    await waitFor(() => expect(registrosService.criar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Salvo no prontuário às/));
  });

  test('esconder a aba grava na hora, sem esperar os 10 s', async () => {
    registrosService.criar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 1, conteudo: 'Texto' });
    render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Texto');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    try {
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      await waitFor(() => expect(registrosService.criar).toHaveBeenCalledTimes(1));
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    }
  });

  test('sair da tela antes dos 10 s grava o texto pendente', async () => {
    registrosService.criar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 1, conteudo: 'Texto' });
    const { unmount } = render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Texto pendente');
    await avancar(3000);
    unmount();
    expect(registrosService.criar).toHaveBeenCalledWith(expect.objectContaining({ conteudo: 'Texto pendente' }), 'p1', 'medico-1');
  });

  test('sair da tela grava o que falta e não repete texto já salvo', async () => {
    registrosService.criar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 1, conteudo: 'Texto' });
    const { unmount } = render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Texto');
    await avancar(10000);
    await waitFor(() => expect(registrosService.criar).toHaveBeenCalledTimes(1));
    unmount();
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    expect(registrosService.atualizar).not.toHaveBeenCalled();
  });

  // Gravação em andamento: a resposta do servidor ainda não chegou.
  const criarPendente = () => {
    let resolver;
    registrosService.criar.mockImplementationOnce(() => new Promise(r => { resolver = r; }));
    return (dados) => act(async () => { resolver({ id: 'r1', status: 'Rascunho', versao: 1, ...dados }); });
  };

  test('sair da tela durante uma gravação: o texto digitado depois é gravado em seguida, no mesmo rascunho', async () => {
    const responder = criarPendente();
    registrosService.atualizar.mockResolvedValue({ id: 'r1', status: 'Rascunho', versao: 2 });
    const { unmount } = render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Parte 1');
    await avancar(10000);
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    digitar('Parte 1 e parte 2');
    unmount();
    await responder({ conteudo: 'Parte 1' });
    await avancar(0);
    expect(registrosService.atualizar).toHaveBeenCalledWith('r1',
      expect.objectContaining({ conteudo: 'Parte 1 e parte 2', versao: 1 }), 'medico-1', false);
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
  });

  test('Finalizar durante uma gravação automática não é ignorado: assina o mesmo rascunho logo depois', async () => {
    const responder = criarPendente();
    registrosService.atualizar.mockResolvedValue({ id: 'r1', status: 'Assinado', versao: 2 });
    render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Texto final');
    await avancar(10000);
    fireEvent.click(screen.getByRole('button', { name: /Finalizar e Assinar/ }));
    expect(screen.getAllByRole('button', { name: 'Salvando...' }).length).toBeGreaterThan(0);
    await responder({ conteudo: 'Texto final' });
    await avancar(0);
    await waitFor(() => expect(registrosService.atualizar).toHaveBeenCalledWith('r1',
      expect.objectContaining({ conteudo: 'Texto final', versao: 1 }), 'medico-1', true));
    await waitFor(() => expect(caixa()).toHaveValue(''));
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    // Assinado: nada de rascunho novo com o mesmo texto.
    await avancar(20000);
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    expect(registrosService.atualizar).toHaveBeenCalledTimes(1);
  });

  test('digitar durante uma gravação: a cópia da aba guarda o texto novo, não o enviado', async () => {
    const { lerRascunhoAtendimento } = require('../../utils/rascunhoAtendimento');
    const responder = criarPendente();
    render(<Tela />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Antes');
    await avancar(10000);
    digitar('Antes e depois');
    await avancar(2000); // cópia local (1,5 s) já tem o texto novo
    await responder({ conteudo: 'Antes' });
    expect(lerRascunhoAtendimento('p1', 'medico-1')).toEqual({ texto: 'Antes e depois', registroId: 'r1', versao: 1 });
    expect(screen.getByRole('status')).toHaveTextContent(/serão salvas no prontuário em instantes/);
  });

  test('trocar de paciente com gravação em andamento: a resposta atrasada não aparece no paciente novo', async () => {
    const { lerRascunhoAtendimento } = require('../../utils/rascunhoAtendimento');
    const { useNavigate } = require('react-router-dom');
    const responder = criarPendente();
    function Ir() { const navegar = useNavigate(); return <button onClick={() => navegar('/prontuario/p2')}>ir p2</button>; }
    function DoisPacientes() {
      const [pacientes, setPacientes] = React.useState([
        { id: 'p1', nome: 'Paciente Um', registros: [] }, { id: 'p2', nome: 'Paciente Dois', registros: [] }]);
      return <MemoryRouter initialEntries={['/prontuario/p1']}><Ir /><Routes>
        <Route path="/prontuario/:id" element={<ProntuarioPage pacientes={pacientes} setPacientes={setPacientes} />} />
      </Routes></MemoryRouter>;
    }
    render(<DoisPacientes />);
    await screen.findByText('Nenhum registro ainda.');
    digitar('Texto do paciente um');
    await avancar(10000);
    fireEvent.click(screen.getByText('ir p2'));
    await screen.findByText('Paciente Dois');
    await responder({ conteudo: 'Texto do paciente um', paciente_id: 'p1' });
    await avancar(0);
    expect(caixa()).toHaveValue('');
    expect(screen.queryByText(/Salvo no prontuário/)).not.toBeInTheDocument();
    expect(lerRascunhoAtendimento('p2', 'medico-1').texto).toBe('');
    expect(lerRascunhoAtendimento('p1', 'medico-1')).toEqual({ texto: 'Texto do paciente um', registroId: 'r1', versao: 1 });
    expect(registrosService.criar).toHaveBeenCalledTimes(1);
    expect(registrosService.atualizar).not.toHaveBeenCalled();
  });
});

test('antecedentes alterados por outra pessoa não são sobrescritos sem escolha explícita', async () => {
  const { pacientesService } = require('../../services/pacientes.service');
  registrosService.listarPorPaciente.mockResolvedValue([]);
  const atualizar = jest.spyOn(pacientesService, 'atualizarClinicos')
    .mockRejectedValueOnce(Object.assign(new Error('Os dados clínicos deste paciente foram alterados'), { code: 'P4090' }))
    .mockResolvedValueOnce({ id: 'p1', nome: 'Paciente Fictício', alergias: 'Minha', versaoClinica: 4, registros: [] });
  jest.spyOn(pacientesService, 'buscarPorId').mockResolvedValue({ id: 'p1', nome: 'Paciente Fictício', alergias: 'Dela', versaoClinica: 3, registros: [] });

  function TelaVersionada() {
    const [pacientes, setPacientes] = React.useState([{ id: 'p1', nome: 'Paciente Fictício', alergias: '', versaoClinica: 2, registros: [] }]);
    return <MemoryRouter initialEntries={['/prontuario/p1']}><Routes>
      <Route path="/prontuario/:id" element={<ProntuarioPage pacientes={pacientes} setPacientes={setPacientes} />} />
    </Routes></MemoryRouter>;
  }
  render(<TelaVersionada />);
  await screen.findByText('Nenhum registro ainda.');
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByPlaceholderText('Informe medicamentos, substâncias ou alimentos'), { target: { value: 'Minha' } });
  fireEvent.click(screen.getByRole('button', { name: '✓ Salvar' }));

  expect(await screen.findByText(/Outra pessoa alterou os dados clínicos/)).toBeInTheDocument();
  expect(atualizar).toHaveBeenLastCalledWith('p1', expect.objectContaining({ alergias: 'Minha' }), 2);
  expect(screen.getByRole('button', { name: '✓ Salvar' })).toBeDisabled();
  expect(screen.getByPlaceholderText('Informe medicamentos, substâncias ou alimentos')).toHaveValue('Minha');

  fireEvent.click(screen.getByRole('button', { name: /Manter os meus/ }));
  fireEvent.click(screen.getByRole('button', { name: '✓ Salvar' }));
  await waitFor(() => expect(atualizar).toHaveBeenLastCalledWith('p1', expect.objectContaining({ alergias: 'Minha' }), 3));
  await waitFor(() => expect(screen.queryByText(/Outra pessoa alterou/)).not.toBeInTheDocument());
});

test('abrir o prontuário registra um acesso, uma única vez', async () => {
  const { supabase } = require('../../services/supabase');
  supabase.rpc.mockResolvedValue({ error: null });
  registrosService.listarPorPaciente.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  render(<Tela />);
  await screen.findByText('Nenhum registro ainda.');
  const chamadas = () => supabase.rpc.mock.calls.filter(([nome]) => nome === 'registrar_acesso');
  expect(chamadas()).toEqual([['registrar_acesso', expect.objectContaining({ p_paciente_id: 'p1', p_acao: 'abrir_prontuario' })]]);
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
  await screen.findByText('Nenhum registro ainda.');
  expect(chamadas()).toHaveLength(1);
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecepcaoPage } from './RecepcaoPage';
import { agendamentosService } from '../../services/agendamentos.service';
import { cobrancasService } from '../../services/cobrancas.service';

jest.mock('../../services/supabase');
jest.mock('../../services/agendamentos.service', () => ({
  agendamentosService: { listarPorData: jest.fn(), ajustarProcedimento: jest.fn(), atualizarStatus: jest.fn(), criar: jest.fn() },
}));
jest.mock('../../services/procedimentos.service', () => ({
  procedimentosService: {
    catalogo: (convenio) => Promise.resolve(convenio === 'conv-1'
      ? [{ id: 'proc-1', nome: 'Consulta', valor: 180 }, { id: 'proc-2', nome: 'Retorno', valor: 90 }]
      : [{ id: 'proc-1', nome: 'Consulta', valor: 300 }, { id: 'proc-2', nome: 'Retorno', valor: 150 }]),
  },
}));
jest.mock('../../services/cobrancas.service', () => ({ cobrancasService: { pagamentosDoDia: jest.fn(), receber: jest.fn() } }));
jest.mock('../../services/convenios.service', () => ({ conveniosService: { listar: () => Promise.resolve([{ id: 'conv-1', nome: 'Convênio X', ativo: true }]) } }));
jest.mock('../../services/usuarios.service', () => ({ usuariosService: { listar: () => Promise.resolve([]) } }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'rec' }, funcao: 'Recepcionista' }) }));
jest.mock('../../hooks/usePacientesCache', () => ({ usePacientesPorIds: () => false, useBuscaPacientes: () => ({ itens: [] }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));

beforeEach(() => { cobrancasService.pagamentosDoDia.mockResolvedValue([]); });

const AG = { id: 'ag-1', pacienteId: 'p1', hora: '09:00', data: '2030-01-01', duracaoMin: 30, status: 'Aguardando', versao: 3, procedimentoId: 'proc-1', convenioId: 'conv-1' };

test('Recepção confirma/ajusta o procedimento na chegada, com a versão da tela', async () => {
  agendamentosService.listarPorData.mockResolvedValue([AG]);
  agendamentosService.ajustarProcedimento.mockResolvedValue({ ...AG, procedimentoId: 'proc-2', versao: 4 });
  render(<MemoryRouter><RecepcaoPage pacientes={[{ id: 'p1', nome: 'Paciente X' }]} /></MemoryRouter>);
  expect(await screen.findByText('Consulta · Convênio X')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar/ajustar procedimento' }));
  await screen.findByRole('option', { name: 'Retorno' });
  fireEvent.change(screen.getByLabelText('Procedimento'), { target: { value: 'proc-2' } });
  expect(await screen.findByText(/R\$\s*90,00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(agendamentosService.ajustarProcedimento).toHaveBeenCalledWith('ag-1', expect.objectContaining({ procedimentoId: 'proc-2', convenioId: 'conv-1' }), 3));
  expect(await screen.findByText('Retorno · Convênio X')).toBeInTheDocument();
});

test('Recepção recebe o particular com desconto em %; convênio não tem o botão', async () => {
  const particular = { ...AG, id: 'ag-2', convenioId: null, procedimentoId: 'proc-1', status: 'Aguardando' };
  agendamentosService.listarPorData.mockResolvedValue([AG, particular]);
  cobrancasService.pagamentosDoDia.mockResolvedValue([]);
  cobrancasService.receber.mockResolvedValue({ cobrancaId: 'c1', valor: 300, desconto: 30, valorPago: 270, formaPagamento: 'PIX' });
  render(<MemoryRouter><RecepcaoPage pacientes={[{ id: 'p1', nome: 'Paciente X' }]} /></MemoryRouter>);
  const botoes = await screen.findAllByRole('button', { name: /Receber/ });
  expect(botoes).toHaveLength(1); // o de convênio não recebe
  fireEvent.click(botoes[0]);
  expect(await screen.findByText(/Valor da tabela/)).toHaveTextContent(/R\$\s*300,00/);
  fireEvent.change(screen.getByLabelText('Desconto'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Tipo do desconto'), { target: { value: '%' } });
  expect(screen.getByText(/A pagar: R\$\s*270,00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  expect(cobrancasService.receber).not.toHaveBeenCalled(); // falta a forma de pagamento
  fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'PIX' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
  await waitFor(() => expect(cobrancasService.receber).toHaveBeenCalledWith('ag-2', { desconto: 30, formaPagamento: 'PIX' }));
  expect(await screen.findByText(/Recebido R\$\s*270,00/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Receber/ })).not.toBeInTheDocument();
});

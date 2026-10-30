import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FinanceiroPage } from './FinanceiroPages';
import { cobrancasService } from '../../services/cobrancas.service';

jest.mock('../../services/supabase');
jest.mock('../../services/cobrancas.service', () => ({
  cobrancasService: { listar: jest.fn(), resumoFinanceiro: jest.fn(), atualizarStatus: jest.fn(), ajustar: jest.fn(), registrarPagamento: jest.fn() },
}));
jest.mock('../../services/procedimentos.service', () => ({ procedimentosService: { listar: () => Promise.resolve([
  { id: 'proc-1', nome: 'Consulta', codigo: '10101012', tipo: 'Consulta', valorParticular: 300, ativo: true },
]) } }));
jest.mock('../../services/convenios.service', () => ({ conveniosService: { listar: () => Promise.resolve([
  { id: 'conv-1', nome: 'Unimed', ativo: true, particular: false },
]) } }));
jest.mock('../../services/usuarios.service', () => ({ usuariosService: { listar: () => Promise.resolve([]) } }));
let mockAuth = { user: { id: 'fin' }, funcao: 'Financeiro' };
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('../../hooks/usePacientesCache', () => ({ useBuscaPacientes: () => ({ itens: [] }), usePacientesPorIds: () => false }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));

const cobranca = (i, dados = {}) => ({
  id: `c${i}`, pacienteId: 'p1', valor: 10, desconto: 0, glosa: 0, valorPago: 10, recebido: 0, recebidoClinica: 0, recebidoProfissional: 0,
  valorRepasse: 5, status: 'Pendente', dataCobranca: '2030-01-15', convenioId: null, versao: 1, ...dados,
});
const RESUMO = { quantidade: 1502, valor: 15007, desconto: 7, valorPago: 15000, glosa: 0, recebido: 9000, recebidoClinica: 3600, recebidoProfissional: 5400 };
const tela = () => render(<MemoryRouter><FinanceiroPage pacientes={[{ id: 'p1', nome: 'Maria' }]} /></MemoryRouter>);

beforeEach(() => { mockAuth = { user: { id: 'fin' }, funcao: 'Financeiro' }; });

test('colunas pedidas e o total do período vindo do banco, não da soma da página carregada', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(1), cobranca(2)], total: 1502 });
  cobrancasService.resumoFinanceiro.mockResolvedValue(RESUMO);
  tela();
  const tabela = await screen.findByRole('table', { name: 'Atendimentos do período' });
  expect(within(tabela).getAllByRole('columnheader').map(h => h.textContent)).toEqual([
    'Paciente', 'Data do atendimento', 'Valor do procedimento', 'Desconto', 'Valor pago', 'Glosa', 'Valor recebido',
    'Recebido pela clínica', 'Recebido pelo profissional', 'Situação', '',
  ]);
  const total = await within(tabela).findByRole('row', { name: /Total — 1502 atendimentos/ });
  expect(total).toHaveTextContent(/15\.007,00.*7,00.*15\.000,00.*9\.000,00.*3\.600,00.*5\.400,00/);
  expect(screen.getByText('Mostrando 2 de 1502')).toBeInTheDocument();
});

test('carregar mais busca a próxima página e acrescenta à lista', async () => {
  cobrancasService.listar
    .mockResolvedValueOnce({ itens: [cobranca(1)], total: 2 })
    .mockResolvedValueOnce({ itens: [cobranca(2)], total: 2 });
  cobrancasService.resumoFinanceiro.mockResolvedValue({ ...RESUMO, quantidade: 2 });
  tela();
  fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }));
  expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
  expect(cobrancasService.listar).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1, limite: 100 }));
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
});

test('falha nos totais: avisa e recarrega só os totais (nunca um total falso)', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(1)], total: 1 });
  cobrancasService.resumoFinanceiro
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ...RESUMO, quantidade: 1 });
  tela();
  await screen.findByText('Mostrando 1 de 1');
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível calcular os totais');
  expect(screen.getByText('Total indisponível')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar totais' }));
  expect(await screen.findByText('Total — 1 atendimento')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(cobrancasService.listar).toHaveBeenCalledTimes(1);
});

test('resposta atrasada de um período antigo não substitui a do período novo', async () => {
  let resolverAntigo;
  cobrancasService.listar
    .mockImplementationOnce(() => new Promise(r => { resolverAntigo = r; }))
    .mockResolvedValueOnce({ itens: [cobranca(9)], total: 1 });
  cobrancasService.resumoFinanceiro.mockResolvedValue({ ...RESUMO, quantidade: 1 });
  tela();
  fireEvent.change(screen.getByLabelText('De'), { target: { value: '2030-01-01' } });
  await screen.findByText('Mostrando 1 de 1');
  await act(async () => { resolverAntigo({ itens: [cobranca(1), cobranca(2), cobranca(3)], total: 3 }); });
  expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument();
});

test('sem procedimento: não pode ser recebida com zero; o Financeiro define procedimento e valor', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(7, { valor: 0, valorPago: 0, agendamentoId: 'ag-1', descricao: 'Atendimento — procedimento a definir' })], total: 1 });
  cobrancasService.resumoFinanceiro.mockResolvedValue({ ...RESUMO, quantidade: 1 });
  cobrancasService.ajustar.mockResolvedValue(cobranca(7, { valor: 250, valorPago: 250, agendamentoId: 'ag-1', versao: 2, descricao: 'Consulta' }));
  tela();
  expect(await screen.findByText('valor a definir')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Receber' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }));
  fireEvent.change(screen.getByLabelText('Procedimento'), { target: { value: 'proc-1' } });
  expect(screen.getByLabelText('Descrição')).toHaveValue('Consulta');
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(cobrancasService.ajustar).toHaveBeenCalledWith('c7', { valor: 250, descricao: 'Consulta', procedimentoId: 'proc-1' }, 1));
  await waitFor(() => expect(screen.queryByText('valor a definir')).not.toBeInTheDocument());
});

test('receber particular com desconto em %; convênio com glosa parcial ou total', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [
    cobranca(1, { valor: 300, valorPago: 300 }),
    cobranca(2, { valor: 180, valorPago: 180, convenioId: 'conv-1', pacienteId: 'p1' }),
  ], total: 2 });
  cobrancasService.resumoFinanceiro.mockResolvedValue({ ...RESUMO, quantidade: 2 });
  cobrancasService.registrarPagamento.mockImplementation((id, d) => Promise.resolve(cobranca(id.slice(1), { status: 'Pago', valor: id === 'c1' ? 300 : 180, desconto: d.desconto, glosa: d.glosa })));
  cobrancasService.atualizarStatus.mockResolvedValue(cobranca(2, { status: 'Glosado', valor: 180, glosa: 180 }));
  tela();
  const [receberParticular] = await screen.findAllByRole('button', { name: 'Receber' });
  fireEvent.click(receberParticular);
  fireEvent.change(screen.getByLabelText('Desconto'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Tipo do desconto'), { target: { value: '%' } });
  expect(screen.getByText(/A pagar: R\$\s*270,00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'PIX' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(cobrancasService.registrarPagamento).toHaveBeenCalledWith('c1', { desconto: 30, glosa: 0, formaPagamento: 'PIX' }, 1));

  fireEvent.click(screen.getByRole('button', { name: 'Receber' }));
  expect(screen.queryByLabelText('Desconto')).not.toBeInTheDocument(); // convênio não tem desconto
  fireEvent.change(screen.getByLabelText('Glosa'), { target: { value: '50' } });
  expect(screen.getByText(/Recebido: R\$\s*130,00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Glosa'), { target: { value: '180' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(cobrancasService.atualizarStatus).toHaveBeenCalledWith('c2', 'Glosado', 1));
});

test('médico vê só o próprio repasse, sem a parte da clínica nem ações', async () => {
  mockAuth = { user: { id: 'med' }, funcao: 'Médico' };
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(1, { status: 'Pago', recebido: 10, recebidoProfissional: 6 })], total: 1 });
  cobrancasService.resumoFinanceiro.mockResolvedValue({ ...RESUMO, quantidade: 1 });
  tela();
  const tabela = await screen.findByRole('table', { name: 'Atendimentos do período' });
  const titulos = within(tabela).getAllByRole('columnheader').map(h => h.textContent);
  expect(titulos).toContain('Seu repasse');
  expect(titulos).not.toContain('Recebido pela clínica');
  expect(screen.queryByRole('button', { name: 'Receber' })).not.toBeInTheDocument();
  expect(cobrancasService.listar).toHaveBeenCalledWith(expect.objectContaining({ medicoId: 'med' }));
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConveniosTabelasPage } from './ConveniosPage';
import { conveniosService } from '../../services/convenios.service';
import { procedimentosService } from '../../services/procedimentos.service';
import { lerPlanilha } from '../../utils/planilha';

jest.mock('../../services/supabase');
jest.mock('../../services/convenios.service', () => ({
  conveniosService: { listar: jest.fn(), atualizar: jest.fn(), tabela: jest.fn(), importarTabela: jest.fn(), criar: jest.fn(), definirValor: jest.fn(), removerValor: jest.fn(), excluir: jest.fn() },
}));
jest.mock('../../services/procedimentos.service', () => ({
  TIPOS_PROCEDIMENTO: ['Consulta', 'Exame', 'Procedimento'],
  procedimentosService: { listar: jest.fn(), criar: jest.fn(), atualizar: jest.fn(), excluir: jest.fn(), catalogo: jest.fn() },
}));
jest.mock('../../utils/planilha', () => ({ lerPlanilha: jest.fn(), baixarPlanilha: jest.fn(() => Promise.resolve()) }));
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});

const UNIMED = { id: 'conv-1', nome: 'Unimed', ativo: true, particular: false, razaoSocial: '', cnpj: '', registroAns: '', codigoPrestador: '', telefone: '',
  email: '', site: '', cep: '', endereco: '', cidade: '', uf: '', contato: '', prazoPagamentoDias: '', tabelaReferencia: '', observacoes: '' };
const CONSULTA = { id: 'proc-1', nome: 'Consulta', codigo: '10101012', tipo: 'Consulta', valorParticular: 300, ativo: true };

beforeEach(() => {
  conveniosService.listar.mockResolvedValue([UNIMED]);
  procedimentosService.listar.mockResolvedValue([CONSULTA]);
  conveniosService.tabela.mockResolvedValue([{ id: 'v1', procedimentoId: 'proc-1', codigo: '10101012', nome: 'Consulta', tipo: 'Consulta', valor: 180, ativo: true }]);
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

async function abrirUnimed() {
  render(<MemoryRouter><ConveniosTabelasPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Unimed/ }));
  await screen.findByText(/R\$\s*180,00/);
}

test('dados da operadora: CNPJ inválido não vai ao banco; válido (inclusive alfanumérico) é salvo', async () => {
  conveniosService.atualizar.mockImplementation((id, dados) => Promise.resolve({ ...UNIMED, ...dados, cnpj: dados.cnpj.replace(/[^0-9A-Z]/g, '') }));
  await abrirUnimed();
  fireEvent.change(screen.getByLabelText('Razão social da operadora'), { target: { value: 'Unimed Cooperativa' } });
  fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '11222333000182' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('CNPJ inválido');
  expect(conveniosService.atualizar).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12abc34501de35' } });
  expect(screen.getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35');
  fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }));
  await waitFor(() => expect(conveniosService.atualizar).toHaveBeenCalledWith('conv-1', expect.objectContaining({
    razaoSocial: 'Unimed Cooperativa', cnpj: '12.ABC.345/01DE-35',
  })));
});

test('importação: mostra a prévia e os erros; com erro, só importa as linhas certas se pedido, e nunca substitui', async () => {
  lerPlanilha.mockResolvedValue({
    itens: [{ codigo: '10101012', descricao: 'Consulta', valor: '190.00', tipo: null }, { codigo: '40304361', descricao: 'Hemograma', valor: '12.50', tipo: null }],
    erros: [{ linha: 5, motivo: 'valor inválido (abc)' }],
    avisos: [],
  });
  conveniosService.importarTabela.mockResolvedValue({ gravados: 2, procedimentosNovos: 1, removidos: 0 });
  await abrirUnimed();
  fireEvent.click(screen.getByRole('button', { name: /Importar planilha/ }));
  const arquivo = new File(['x'], 'unimed.xlsx');
  fireEvent.change(screen.getByLabelText('Arquivo da tabela'), { target: { files: [arquivo] } });

  expect(await screen.findByText(/2 linhas prontas, 1 com problema/)).toBeInTheDocument();
  expect(screen.getByText('Linha 5: valor inválido (abc)')).toBeInTheDocument();
  expect(screen.getByRole('row', { name: /Hemograma/ })).toHaveTextContent(/12,50/);
  const importar = screen.getByRole('button', { name: 'Importar 2 linhas' });
  expect(importar).toBeDisabled();

  fireEvent.click(screen.getByLabelText(/Importar só as 2 linhas certas/));
  expect(importar).toBeEnabled();
  fireEvent.click(screen.getByLabelText(/Substituir a tabela inteira/));
  expect(importar).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Acrescentar e atualizar/));

  fireEvent.click(importar);
  await waitFor(() => expect(conveniosService.importarTabela).toHaveBeenCalledWith('conv-1', expect.any(Array), false));
  expect(conveniosService.importarTabela.mock.calls[0][1]).toHaveLength(2);
  await waitFor(() => expect(conveniosService.tabela).toHaveBeenCalledTimes(2)); // recarrega a tabela
  expect(procedimentosService.listar).toHaveBeenCalledTimes(2); // e o catálogo (procedimento novo)
});

test('substituir a tabela pede confirmação; recusa do banco não muda nada e avisa', async () => {
  lerPlanilha.mockResolvedValue({ itens: [{ codigo: '10101012', descricao: 'Consulta', valor: '190.00', tipo: null }], erros: [], avisos: [] });
  conveniosService.importarTabela.mockRejectedValue(new Error('Linha 1: valor inválido'));
  await abrirUnimed();
  fireEvent.click(screen.getByRole('button', { name: /Importar planilha/ }));
  fireEvent.change(screen.getByLabelText('Arquivo da tabela'), { target: { files: [new File(['x'], 't.csv')] } });
  fireEvent.click(await screen.findByLabelText(/Substituir a tabela inteira/));
  fireEvent.click(screen.getByRole('button', { name: 'Importar 1 linhas' }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Substituir a tabela do Unimed'));
  expect(await screen.findByText(/A importação não foi gravada \(nada mudou\)/)).toBeInTheDocument();
  expect(conveniosService.importarTabela).toHaveBeenCalledWith('conv-1', expect.any(Array), true);
});

test('catálogo de procedimentos: código, tipo e valor particular, sem repasse', async () => {
  procedimentosService.criar.mockImplementation((d) => Promise.resolve({ id: 'proc-2', ativo: true, ...d, valorParticular: Number(d.valorParticular) }));
  render(<MemoryRouter><ConveniosTabelasPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('tab', { name: 'Procedimentos' }));
  expect(screen.getByText('10101012 — Consulta')).toBeInTheDocument();
  expect(screen.queryByText(/repasse/i, { selector: 'div' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Código'), { target: { value: '40304361' } });
  fireEvent.change(screen.getByLabelText('Nome do procedimento'), { target: { value: 'Hemograma' } });
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Exame' } });
  fireEvent.change(screen.getByLabelText('Valor particular'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: /Cadastrar/ }));
  await waitFor(() => expect(procedimentosService.criar).toHaveBeenCalledWith({ codigo: '40304361', nome: 'Hemograma', tipo: 'Exame', valorParticular: '25' }));
  expect(await screen.findByText('40304361 — Hemograma')).toBeInTheDocument();
});

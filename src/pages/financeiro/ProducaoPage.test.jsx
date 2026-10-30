import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProducaoPage } from './ProducaoPage';
import { producaoService } from '../../services/producao.service';

jest.mock('../../services/supabase');
jest.mock('../../services/producao.service', () => ({ producaoService: { relatorio: jest.fn() } }));
jest.mock('../../services/usuarios.service', () => ({
  usuariosService: {
    listar: () => Promise.resolve([
      { id: 'med-1', nome: 'Dra. Ana', funcao: 'Médico', ativo: true },
      { id: 'enf-1', nome: 'Enf. Bia', funcao: 'Enfermeiro(a)', ativo: true },
      { id: 'rec-1', nome: 'Recepção', funcao: 'Recepcionista', ativo: true },
    ]),
  },
}));
let mockAuth;
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('../../components/common/Layout', () => ({ Header: () => null, CabecalhoImpresso: () => null }));
jest.mock('../../utils/formatters', () => ({
  ...jest.requireActual('../../utils/formatters'),
  dataLocalISO: () => '2026-10-25',
}));

// Valores já como o banco devolve (migração 54).
const linha = (dados) => ({
  id: Math.random().toString(36), data: '2026-10-10', status: 'Pago', daAgenda: true, pacienteId: 'p1', paciente: 'Paciente X',
  profissionalId: 'med-1', profissional: 'Dra. Ana', especialidade: 'Cardiologia', procedimentoId: 'proc-c', codigo: '10101012',
  procedimento: 'Consulta', tipo: 'Consulta', convenioId: null, convenio: '', particular: true, formaPagamento: 'PIX',
  valor: 300, desconto: 30, valorPago: 270, glosa: 0, percentualRepasse: 60, recebido: 270, recebidoClinica: 108, recebidoProfissional: 162,
  ...dados,
});
const LINHAS = [
  linha({}),
  linha({ convenioId: 'conv-1', convenio: 'Unimed', particular: false, valor: 180, desconto: 0, valorPago: 180, glosa: 50, recebido: 130, recebidoClinica: 52, recebidoProfissional: 78 }),
  linha({ status: 'Pendente', procedimento: 'Ecocardiograma', tipo: 'Exame', valor: 250, desconto: 0, valorPago: 250, recebido: 0, recebidoClinica: 0, recebidoProfissional: 0 }),
  linha({ profissionalId: 'enf-1', profissional: 'Enf. Bia', especialidade: '', procedimento: 'Curativo', tipo: 'Procedimento',
    valor: 50, desconto: 0, valorPago: 50, recebido: 50, recebidoClinica: 40, recebidoProfissional: 10 }),
];

const tela = () => render(<MemoryRouter><ProducaoPage /></MemoryRouter>);
const titulos = (tabela) => within(tabela).getAllByRole('columnheader').map(h => h.textContent);

test('Administrador: relatório completo com as colunas pedidas e a soma no fim', async () => {
  mockAuth = { user: { id: 'adm' }, funcao: 'Administrador', perfil: { nome: 'Admin' } };
  producaoService.relatorio.mockResolvedValue(LINHAS);
  tela();
  const tabela = await screen.findByRole('table', { name: 'Completo — 4 atendimentos' });
  expect(producaoService.relatorio).toHaveBeenCalledWith({ de: '2026-10-01', ate: '2026-10-31', profissionalId: '' });
  expect(titulos(tabela)).toEqual(['Paciente', 'Data do atendimento', 'Procedimento', 'Convênio', 'Profissional',
    'Valor do procedimento', 'Desconto', 'Valor pago', 'Glosa', 'Valor recebido', 'Recebido pela clínica', 'Recebido pelo profissional', 'Situação']);
  expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent(/R\$\s*300,00R\$\s*30,00 \(10%\)R\$\s*270,00—R\$\s*270,00R\$\s*108,00R\$\s*162,00Pago/);
  const total = within(tabela).getByRole('row', { name: /Total — 4 atendimentos/ });
  expect(total).toHaveTextContent(/R\$\s*780,00.*R\$\s*30,00.*R\$\s*750,00R\$\s*50,00R\$\s*450,00R\$\s*200,00R\$\s*250,00/);
  expect(screen.getByRole('group', { name: 'Recebido pela clínica' })).toHaveTextContent('200,00');
});

test('visões: só clínica, só profissional, por profissional, por especialidade e por tipo', async () => {
  mockAuth = { user: { id: 'adm' }, funcao: 'Administrador', perfil: { nome: 'Admin' } };
  producaoService.relatorio.mockResolvedValue(LINHAS);
  tela();
  await screen.findByRole('table', { name: /Completo/ });
  const visao = screen.getByLabelText('Visão do relatório');

  fireEvent.change(visao, { target: { value: 'clinica' } });
  let t = screen.getByRole('table', { name: /Só dados da clínica/ });
  expect(titulos(t)).toContain('Recebido pela clínica');
  expect(titulos(t)).not.toContain('Recebido pelo profissional');

  fireEvent.change(visao, { target: { value: 'profissional' } });
  t = screen.getByRole('table', { name: /Só dados do profissional/ });
  expect(titulos(t)).not.toContain('Recebido pela clínica');
  expect(screen.queryByRole('group', { name: 'Recebido pela clínica' })).not.toBeInTheDocument();

  fireEvent.change(visao, { target: { value: 'por-profissional' } });
  t = screen.getByRole('table', { name: 'Por profissional' });
  expect(within(t).getByRole('row', { name: /Dra\. Ana/ })).toHaveTextContent(/^Dra\. Ana3/);
  expect(within(t).getByRole('row', { name: /Dra\. Ana/ })).toHaveTextContent(/R\$\s*400,00R\$\s*160,00R\$\s*240,0088,9%$/);

  fireEvent.change(visao, { target: { value: 'por-especialidade' } });
  t = screen.getByRole('table', { name: 'Por especialidade do profissional' });
  expect(within(t).getByRole('row', { name: /Cardiologia/ })).toBeInTheDocument();
  expect(within(t).getByRole('row', { name: /Sem especialidade informada/ })).toBeInTheDocument();

  fireEvent.change(visao, { target: { value: 'por-tipo' } });
  t = screen.getByRole('table', { name: 'Por tipo de atendimento' });
  expect(within(t).getAllByRole('row').slice(1).map(r => r.textContent.split(/\d/)[0])).toEqual(['Consulta', 'Exame', 'Procedimento', 'Total']);
  expect(producaoService.relatorio).toHaveBeenCalledTimes(1); // trocar a visão não consulta o banco de novo
});

test('profissional: só as próprias visões, sem a parte da clínica; intervalo de dias', async () => {
  mockAuth = { user: { id: 'enf-1' }, funcao: 'Enfermeiro(a)', perfil: { nome: 'Enf. Bia' } };
  producaoService.relatorio.mockResolvedValue([LINHAS[3]]);
  tela();
  expect(await screen.findByRole('group', { name: 'Seu repasse' })).toHaveTextContent(/10,00/);
  expect(screen.queryByLabelText('Profissional')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Recebido pela clínica' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('option', { name: /Meus atendimentos|Por tipo de atendimento/ })).toHaveLength(2);
  expect(screen.queryByRole('option', { name: 'Por profissional' })).not.toBeInTheDocument();
  expect(producaoService.relatorio).toHaveBeenCalledWith({ de: '2026-10-01', ate: '2026-10-31', profissionalId: null });

  fireEvent.click(screen.getByLabelText('Intervalo de dias'));
  fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-05' } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-12' } });
  expect(producaoService.relatorio).toHaveBeenLastCalledWith({ de: '2026-10-05', ate: '2026-10-12', profissionalId: null });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('anterior ou igual');
});

test('mês e ano escolhidos em listas', async () => {
  mockAuth = { user: { id: 'med-1' }, funcao: 'Médico', perfil: { nome: 'Dra. Ana' } };
  producaoService.relatorio.mockResolvedValue([]);
  tela();
  expect(await screen.findByText(/Nenhum atendimento/)).toBeInTheDocument();
  expect(screen.getByLabelText('Mês do relatório')).toHaveDisplayValue('Outubro');
  fireEvent.change(screen.getByLabelText('Mês do relatório'), { target: { value: '02' } });
  fireEvent.change(screen.getByLabelText('Ano do relatório'), { target: { value: '2024' } });
  expect(producaoService.relatorio).toHaveBeenLastCalledWith({ de: '2024-02-01', ate: '2024-02-29', profissionalId: null });
});

test('falha do banco aparece como falha, com nova tentativa', async () => {
  mockAuth = { user: { id: 'med-1' }, funcao: 'Médico', perfil: { nome: 'Dra. Ana' } };
  producaoService.relatorio.mockRejectedValueOnce(new Error('sem conexão')).mockResolvedValue([LINHAS[0]]);
  tela();
  expect(await screen.findByRole('alert')).toHaveTextContent('sem conexão');
  expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByRole('table', { name: 'Meus atendimentos — 1 atendimento' })).toBeInTheDocument();
});

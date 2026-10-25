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

const linha = (dados) => ({
  id: Math.random().toString(36), data: '2026-10-10', status: 'Pago', daAgenda: true, pacienteId: 'p1', paciente: 'Paciente X',
  profissionalId: 'med-1', profissional: 'Dra. Ana', procedimentoId: 'proc-c', codigo: '10101012', procedimento: 'Consulta',
  tipo: 'Consulta', convenioId: 'conv-1', convenio: 'Unimed', formaPagamento: '', valor: 200, percentualRepasse: 60,
  valorRepasse: 120, valorClinica: 80, ...dados,
});
const LINHAS = [
  linha({}),
  linha({ status: 'Pendente' }),
  linha({ procedimentoId: 'proc-h', codigo: '40304361', procedimento: 'Hemograma', tipo: 'Exame', valor: 20, percentualRepasse: 10, valorRepasse: 2, valorClinica: 18 }),
  linha({ profissionalId: 'enf-1', profissional: 'Enf. Bia', procedimentoId: 'proc-k', codigo: '', procedimento: 'Curativo', tipo: 'Procedimento',
    convenioId: null, convenio: '', valor: 50, percentualRepasse: 20, valorRepasse: 10, valorClinica: 40, status: 'Glosado' }),
];

const tela = () => render(<MemoryRouter><ProducaoPage /></MemoryRouter>);

test('Administrador: produção de todos no mês, por profissional e por procedimento, com o que fica para a clínica', async () => {
  mockAuth = { user: { id: 'adm' }, funcao: 'Administrador', perfil: { nome: 'Admin' } };
  producaoService.relatorio.mockResolvedValue(LINHAS);
  tela();
  const porProfissional = await screen.findByRole('table', { name: 'Por profissional' });
  expect(producaoService.relatorio).toHaveBeenCalledWith({ de: '2026-10-01', ate: '2026-10-31', profissionalId: '' });
  expect(within(porProfissional).getByRole('row', { name: /Dra\. Ana/ })).toHaveTextContent(/Dra\. Ana3R\$\s*420,00R\$\s*242,00R\$\s*178,0089,4%/);
  expect(within(porProfissional).getByRole('row', { name: /Total/ })).toHaveTextContent(/Total4R\$\s*470,00R\$\s*252,00R\$\s*218,00100%/);
  expect(screen.getByRole('group', { name: 'Fica para a clínica' })).toHaveTextContent(/218,00/);
  expect(screen.getByRole('group', { name: 'Glosado' })).toHaveTextContent(/50,00/);

  // Filtro por tipo, sem nova consulta ao banco.
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Exame' } });
  const porProcedimento = screen.getByRole('table', { name: 'Por procedimento' });
  expect(within(porProcedimento).getAllByRole('row')).toHaveLength(3); // cabeçalho, Hemograma, total
  expect(within(porProcedimento).getByText('Hemograma')).toBeInTheDocument();
  expect(producaoService.relatorio).toHaveBeenCalledTimes(1);

  // Um profissional: o banco filtra.
  fireEvent.change(await screen.findByLabelText('Profissional'), { target: { value: 'enf-1' } });
  expect(producaoService.relatorio).toHaveBeenLastCalledWith({ de: '2026-10-01', ate: '2026-10-31', profissionalId: 'enf-1' });
  expect(screen.queryByRole('option', { name: 'Recepção' })).not.toBeInTheDocument();
});

test('profissional: só a própria produção, com intervalo de dias, sem a parte da clínica', async () => {
  mockAuth = { user: { id: 'enf-1' }, funcao: 'Enfermeiro(a)', perfil: { nome: 'Enf. Bia' } };
  producaoService.relatorio.mockResolvedValue([LINHAS[3]]);
  tela();
  expect(await screen.findByRole('group', { name: 'Seu repasse' })).toHaveTextContent(/10,00/);
  expect(screen.queryByLabelText('Profissional')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Fica para a clínica' })).not.toBeInTheDocument();
  expect(producaoService.relatorio).toHaveBeenCalledWith({ de: '2026-10-01', ate: '2026-10-31', profissionalId: null });

  fireEvent.click(screen.getByLabelText('Intervalo de dias'));
  fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-05' } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-12' } });
  expect(producaoService.relatorio).toHaveBeenLastCalledWith({ de: '2026-10-05', ate: '2026-10-12', profissionalId: null });

  fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('anterior ou igual');
});

test('falha do banco aparece como falha, com nova tentativa', async () => {
  mockAuth = { user: { id: 'med-1' }, funcao: 'Médico', perfil: { nome: 'Dra. Ana' } };
  producaoService.relatorio.mockRejectedValueOnce(new Error('sem conexão')).mockResolvedValue([LINHAS[0]]);
  tela();
  expect(await screen.findByRole('alert')).toHaveTextContent('sem conexão');
  expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByRole('table', { name: 'Atendimentos (1)' })).toBeInTheDocument();
});

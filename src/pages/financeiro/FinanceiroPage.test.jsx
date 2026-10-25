import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FinanceiroPage } from './FinanceiroPages';
import { cobrancasService } from '../../services/cobrancas.service';

jest.mock('../../services/supabase');
jest.mock('../../services/cobrancas.service', () => ({
  cobrancasService: { listar: jest.fn(), resumo: jest.fn(), atualizarStatus: jest.fn() },
}));
jest.mock('../../services/procedimentos.service', () => ({ procedimentosService: { listar: () => Promise.resolve([]) } }));
jest.mock('../../services/convenios.service', () => ({ conveniosService: { listar: () => Promise.resolve([]), listarValores: () => Promise.resolve([]) } }));
jest.mock('../../services/usuarios.service', () => ({ usuariosService: { listar: () => Promise.resolve([]) } }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'fin' }, funcao: 'Financeiro' }) }));
jest.mock('../../hooks/usePacientesCache', () => ({ useBuscaPacientes: () => ({ itens: [] }), usePacientesPorIds: () => false }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({ Header: () => null }));

const cobranca = (i) => ({ id: `c${i}`, pacienteId: 'p1', valor: 10, valorRepasse: 5, status: 'Pendente', dataCobranca: '2030-01-15' });
const tela = () => render(<MemoryRouter><FinanceiroPage pacientes={[]} /></MemoryRouter>);

test('total do período vem do banco, não da soma da página carregada', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(1), cobranca(2)], total: 1502 });
  cobrancasService.resumo.mockResolvedValue({ quantidade: 1502, total: 15007, totalRepasse: 7500 });
  tela();
  expect(await screen.findByText(/15\.007,00/)).toBeInTheDocument();
  expect(screen.getByText(/7\.500,00/)).toBeInTheDocument();
  expect(screen.getByText('Mostrando 2 de 1502')).toBeInTheDocument();
});

test('carregar mais busca a próxima página e acrescenta à lista', async () => {
  cobrancasService.listar
    .mockResolvedValueOnce({ itens: [cobranca(1)], total: 2 })
    .mockResolvedValueOnce({ itens: [cobranca(2)], total: 2 });
  cobrancasService.resumo.mockResolvedValue({ quantidade: 2, total: 20, totalRepasse: 10 });
  tela();
  fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }));
  expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
  expect(cobrancasService.listar).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1, limite: 100 }));
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
});

test('falha nos totais: avisa, mostra "Indisponível" (nunca um zero falso) e recarrega só os totais', async () => {
  cobrancasService.listar.mockResolvedValue({ itens: [cobranca(1)], total: 1 });
  cobrancasService.resumo
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ quantidade: 1, total: 10, totalRepasse: 5 });
  tela();
  await screen.findByText('Mostrando 1 de 1');
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível calcular os totais');
  expect(screen.getAllByText('Indisponível')).toHaveLength(2);
  expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Recarregar totais' }));
  expect(await screen.findByText(/R\$\s*10,00/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(cobrancasService.listar).toHaveBeenCalledTimes(1);
});

test('resposta atrasada de um período antigo não substitui a do período novo', async () => {
  let resolverAntigo;
  cobrancasService.listar
    .mockImplementationOnce(() => new Promise(r => { resolverAntigo = r; }))
    .mockResolvedValueOnce({ itens: [cobranca(9)], total: 1 });
  cobrancasService.resumo.mockResolvedValue({ quantidade: 1, total: 10, totalRepasse: 5 });
  tela();
  fireEvent.change(screen.getByLabelText('De'), { target: { value: '2030-01-01' } });
  await screen.findByText('Mostrando 1 de 1');
  await act(async () => { resolverAntigo({ itens: [cobranca(1), cobranca(2), cobranca(3)], total: 3 }); });
  expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument();
});

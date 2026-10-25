import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { PacientesCacheContext, mesclarPacientes, usePacientesPorIds, useBuscaPacientes } from './usePacientesCache';
import { pacientesService } from '../services/pacientes.service';

jest.mock('../services/supabase');

function comCache(iniciais = []) {
  const ref = {};
  function Envoltorio({ children }) {
    const [pacientes, setPacientes] = React.useState(iniciais);
    ref.pacientes = pacientes;
    const valor = React.useMemo(() => ({ pacientes, setPacientes }), [pacientes]);
    return <PacientesCacheContext.Provider value={valor}>{children}</PacientesCacheContext.Provider>;
  }
  return { Envoltorio, ref };
}

test('mesclar atualiza por id e preserva registros já carregados', () => {
  const atuais = [{ id: 'a', nome: 'Ana', registros: [{ id: 'r1' }] }];
  const r = mesclarPacientes(atuais, [{ id: 'a', nome: 'Ana Maria', registros: [] }, { id: 'b', nome: 'Bia', registros: [] }]);
  expect(r).toEqual([{ id: 'a', nome: 'Ana Maria', registros: [{ id: 'r1' }] }, { id: 'b', nome: 'Bia', registros: [] }]);
});

test('busca só os ids que faltam, uma vez', async () => {
  const buscar = jest.spyOn(pacientesService, 'buscarPorIds').mockResolvedValue([{ id: 'b', nome: 'Bia' }]);
  const { Envoltorio, ref } = comCache([{ id: 'a', nome: 'Ana' }]);
  const ids = ['a', 'b', 'b'];
  const { rerender } = renderHook(() => usePacientesPorIds(ids), { wrapper: Envoltorio });
  await waitFor(() => expect(ref.pacientes.map(p => p.id)).toEqual(['a', 'b']));
  rerender();
  expect(buscar).toHaveBeenCalledTimes(1);
  expect(buscar).toHaveBeenCalledWith(['b']);
});

test('busca do seletor não consulta o servidor sem texto digitado', async () => {
  const buscar = jest.spyOn(pacientesService, 'buscar').mockResolvedValue({ itens: [], total: 0 });
  const { Envoltorio } = comCache();
  renderHook(() => useBuscaPacientes('', { limite: 8 }), { wrapper: Envoltorio });
  await act(async () => { await new Promise(r => setTimeout(r, 350)); });
  expect(buscar).not.toHaveBeenCalled();
});

test('carregar mais acrescenta a próxima página', async () => {
  jest.spyOn(pacientesService, 'buscar')
    .mockResolvedValueOnce({ itens: [{ id: '1', nome: 'A' }], total: 2 })
    .mockResolvedValueOnce({ itens: [{ id: '2', nome: 'B' }], total: 2 });
  const { Envoltorio } = comCache();
  const { result } = renderHook(() => useBuscaPacientes('', { listarSemTermo: true, limite: 1 }), { wrapper: Envoltorio });
  await waitFor(() => expect(result.current.itens).toHaveLength(1));
  expect(result.current.temMais).toBe(true);
  act(() => result.current.carregarMais());
  await waitFor(() => expect(result.current.itens.map(p => p.id)).toEqual(['1', '2']));
  expect(result.current.temMais).toBe(false);
  expect(pacientesService.buscar).toHaveBeenLastCalledWith({ termo: '', limite: 1, offset: 1 });
});

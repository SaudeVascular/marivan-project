import { renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { usePacienteAtual } from './usePacienteAtual';

function wrapper({ children }) {
  return (
    <MemoryRouter initialEntries={['/prontuario/2']}>
      <Routes>
        <Route path="/prontuario/:id" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

test('carrega o paciente certo a partir do id na URL, não o primeiro da lista', () => {
  const pacientes = [{ id: 1, nome: 'Ana' }, { id: 2, nome: 'Bruno' }, { id: 3, nome: 'Carla' }];
  const { result } = renderHook(() => usePacienteAtual(pacientes), { wrapper });
  expect(result.current.paciente.nome).toBe('Bruno');
});

test('não confunde ids parecidos (string x number) vindos da URL', () => {
  const pacientes = [{ id: '2', nome: 'Bruno (id como string)' }];
  const { result } = renderHook(() => usePacienteAtual(pacientes), { wrapper });
  expect(result.current.paciente.nome).toBe('Bruno (id como string)');
});

test('retorna undefined quando nenhum paciente bate com o id da URL', () => {
  const pacientes = [{ id: 999, nome: 'Outro paciente' }];
  const { result } = renderHook(() => usePacienteAtual(pacientes), { wrapper });
  expect(result.current.paciente).toBeUndefined();
});

describe('paciente fora do cache', () => {
  const React = require('react');
  const { waitFor } = require('@testing-library/react');
  const { PacientesCacheContext } = require('./usePacientesCache');
  const { pacientesService } = require('../services/pacientes.service');

  function comCache(pacientesIniciais) {
    return function Envoltorio({ children }) {
      const [pacientes, setPacientes] = React.useState(pacientesIniciais);
      const valor = React.useMemo(() => ({ pacientes, setPacientes }), [pacientes]);
      return wrapper({ children: <PacientesCacheContext.Provider value={valor}>{children}</PacientesCacheContext.Provider> });
    };
  }

  test('busca pelo id da URL quando não está no cache (link direto)', async () => {
    const buscar = jest.spyOn(pacientesService, 'buscarPorId').mockResolvedValue({ id: '2', nome: 'Bruno', registros: [] });
    const { result } = renderHook(() => usePacienteAtual(), { wrapper: comCache([]) });
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.paciente?.nome).toBe('Bruno'));
    expect(result.current.carregando).toBe(false);
    expect(buscar).toHaveBeenCalledWith('2');
  });

  test('id inexistente termina em "não encontrado", não em carregando para sempre', async () => {
    jest.spyOn(pacientesService, 'buscarPorId').mockRejectedValue(new Error('PGRST116'));
    const { result } = renderHook(() => usePacienteAtual(), { wrapper: comCache([]) });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.paciente).toBeUndefined();
  });
  test('falha de rede não vira "não encontrado": estado erro, e tentar de novo carrega', async () => {
    const { act } = require('@testing-library/react');
    const buscar = jest.spyOn(pacientesService, 'buscarPorId')
      .mockRejectedValueOnce(Object.assign(new TypeError('Failed to fetch'), { status: 0 }))
      .mockResolvedValueOnce({ id: '2', nome: 'Bruno', registros: [] });
    const { result } = renderHook(() => usePacienteAtual(), { wrapper: comCache([]) });
    await waitFor(() => expect(result.current.estado).toBe('erro'));
    expect(result.current.carregando).toBe(false);
    act(() => { result.current.recarregar(); });
    expect(result.current.estado).toBe('carregando');
    await waitFor(() => expect(result.current.paciente?.nome).toBe('Bruno'));
    expect(result.current.estado).toBe('pronto');
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  test('o banco respondeu sem linha: "não encontrado"', async () => {
    jest.spyOn(pacientesService, 'buscarPorId').mockRejectedValue({ code: 'PGRST116', message: 'no rows' });
    const { result } = renderHook(() => usePacienteAtual(), { wrapper: comCache([]) });
    await waitFor(() => expect(result.current.estado).toBe('nao-encontrado'));
  });

  test('o banco recusou a leitura: "sem permissão"', async () => {
    jest.spyOn(pacientesService, 'buscarPorId').mockRejectedValue({ code: '42501', message: 'permission denied' });
    const { result } = renderHook(() => usePacienteAtual(), { wrapper: comCache([]) });
    await waitFor(() => expect(result.current.estado).toBe('sem-permissao'));
  });
});

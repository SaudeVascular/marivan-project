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

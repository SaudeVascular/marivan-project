import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ImprimirAtendimentoPage } from './DocumentosPages';
import { pacientesService } from '../../services/pacientes.service';
import { registrosService } from '../../services/registros.service';

jest.mock('../../services/pacientes.service');
jest.mock('../../services/registros.service');
jest.mock('../../services/supabase');
jest.mock('../../hooks/useClinica', () => ({ useClinica: () => ({ clinica: {} }) }));

test('falha de carregamento não é apresentada como atendimento inexistente', async () => {
  pacientesService.buscarPorId.mockRejectedValue(new Error('Falha de rede'));
  registrosService.buscarDoPaciente.mockResolvedValue({ id: 'r1', pacienteId: 'p1' });
  render(<MemoryRouter initialEntries={['/imprimir/p1/r1']}><Routes>
    <Route path="/imprimir/:pacienteId/:registroId" element={<ImprimirAtendimentoPage />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o atendimento para impressão');
  expect(screen.queryByText(/Registro não encontrado/)).not.toBeInTheDocument();
});

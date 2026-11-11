import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { SinaisVitaisPage } from './EnfermagemPages';
import { resetSupabaseMockPadrao } from '../../services/supabase';

jest.mock('../../services/supabase');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'enf-1' }, funcaoClinicaEfetiva: 'Enfermeiro(a)' }) }));
jest.mock('../../components/common/Toast', () => {
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
  return { useToast: () => toast };
});
jest.mock('../../components/common/Layout', () => ({ Header: () => null, painelStyle: {} }));

const PACIENTES = [{ id: 'paciente-A', nome: 'Paciente A' }, { id: 'paciente-B', nome: 'Paciente B' }];
function IrPara() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/sinais-vitais/paciente-B')}>ir para B</button>;
}

beforeEach(() => resetSupabaseMockPadrao());

test('sinais vitais digitados para A não aparecem em B', () => {
  render(<MemoryRouter initialEntries={['/sinais-vitais/paciente-A']}>
    <IrPara />
    <Routes><Route path="/sinais-vitais/:id" element={<SinaisVitaisPage pacientes={PACIENTES} setPacientes={jest.fn()} />} /></Routes>
  </MemoryRouter>);
  const campos = () => [...screen.queryAllByRole('textbox'), ...screen.queryAllByRole('spinbutton')];
  expect(campos().length).toBeGreaterThan(0);
  campos().forEach(c => fireEvent.change(c, { target: { value: '120' } }));
  expect(screen.getAllByDisplayValue('120').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'ir para B' }));
  expect(screen.queryAllByDisplayValue('120')).toHaveLength(0);
});

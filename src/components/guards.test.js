import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  SomenteMedico,
  SomenteEnfermagem,
  SomenteRecepcao,
  SomenteAdmin,
} from './guards';

jest.mock('../hooks/useAuth');

// Guards redirecionam pra /pacientes quando a função não tem acesso —
// renderiza as duas rotas pra conseguir enxergar tanto o conteúdo
// protegido quanto o redirecionamento.
function renderComFuncao(Guard, funcao) {
  useAuth.mockReturnValue({ funcao });
  render(
    <MemoryRouter initialEntries={['/protegido']}>
      <Routes>
        <Route path="/protegido" element={<Guard><p>Conteúdo protegido</p></Guard>} />
        <Route path="/pacientes" element={<p>Redirecionado para pacientes</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SomenteMedico — restringe receituário/prescrição/atestado a quem tem CRM', () => {
  test('libera Médico', () => {
    renderComFuncao(SomenteMedico, 'Médico');
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  test('libera Administrador', () => {
    renderComFuncao(SomenteMedico, 'Administrador');
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  test('bloqueia Enfermeiro(a)', () => {
    renderComFuncao(SomenteMedico, 'Enfermeiro(a)');
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Redirecionado para pacientes')).toBeInTheDocument();
  });

  test('bloqueia Recepcionista', () => {
    renderComFuncao(SomenteMedico, 'Recepcionista');
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });
});

describe('SomenteEnfermagem — aba de evolução de enfermagem', () => {
  test('libera Enfermeiro(a)', () => {
    renderComFuncao(SomenteEnfermagem, 'Enfermeiro(a)');
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  test('bloqueia Recepcionista', () => {
    renderComFuncao(SomenteEnfermagem, 'Recepcionista');
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });
});

describe('SomenteRecepcao / SomenteAdmin — acesso não autorizado é bloqueado', () => {
  test('SomenteRecepcao bloqueia Médico', () => {
    renderComFuncao(SomenteRecepcao, 'Médico');
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  test('SomenteAdmin bloqueia Recepcionista', () => {
    renderComFuncao(SomenteAdmin, 'Recepcionista');
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  test('SomenteAdmin libera Administrador', () => {
    renderComFuncao(SomenteAdmin, 'Administrador');
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });
});

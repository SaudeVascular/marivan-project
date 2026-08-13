import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  SomenteMedico,
  SomenteEnfermagem,
  SomenteRecepcao,
  SomenteAdmin,
  ProtectedLayout,
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

// Reload dispara mais de um evento de auth do Supabase quase junto pro
// mesmo usuário; a 1ª leitura do perfil pode estourar o timeout (corre
// contra o cliente ainda restaurando a sessão) antes de uma leitura
// seguinte, já correta, chegar. Nesse intervalo `loading` já é false mas
// `perfilPronto` ainda não — sem esperar por ele aqui, os guards de
// função (SomenteAdmin etc, que rodam dentro de ProtectedLayout) veem
// funcao=null e mandam pra /pacientes mesmo quando o usuário É admin.
describe('ProtectedLayout — não libera os guards de função antes do perfil ter resposta definitiva', () => {
  function renderProtectedLayout({ user, loading, perfilPronto }) {
    useAuth.mockReturnValue({ user, loading, perfilPronto, funcao: 'Administrador' });
    render(
      <MemoryRouter initialEntries={['/protegido']}>
        <Routes>
          <Route
            path="/protegido"
            element={
              <ProtectedLayout>
                <SomenteAdmin><p>Conteúdo protegido</p></SomenteAdmin>
              </ProtectedLayout>
            }
          />
          <Route path="/pacientes" element={<p>Redirecionado para pacientes</p>} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>
    );
  }

  test('sessão confirmada mas perfil ainda não resolvido: mostra carregando, não redireciona', () => {
    renderProtectedLayout({ user: { id: 'u1' }, loading: false, perfilPronto: false });
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('Redirecionado para pacientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  test('perfil resolvido: libera o guard normalmente', () => {
    renderProtectedLayout({ user: { id: 'u1' }, loading: false, perfilPronto: true });
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  test('sem usuário: manda pro login direto, sem esperar perfilPronto', () => {
    renderProtectedLayout({ user: null, loading: false, perfilPronto: false });
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });
});

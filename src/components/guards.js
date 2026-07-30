import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  FUNCOES_CLINICAS,
  FUNCOES_MEDICO,
  FUNCOES_FINANCEIRO,
  FUNCOES_RECEPCAO,
  FUNCOES_ENFERMAGEM,
} from '../constants/roles';

export function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666', fontSize: '16px' }}>Carregando...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="pep-outer">
      {children}
    </div>
  );
}

export function SomenteAdmin({ children }) {
  const { funcao } = useAuth();
  if (funcao !== 'Administrador') return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteClinico({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_CLINICAS.includes(funcao)) return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteMedico({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_MEDICO.includes(funcao)) return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteFinanceiro({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_FINANCEIRO.includes(funcao)) return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteFinanceiroOuMedico({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_FINANCEIRO.includes(funcao) && funcao !== 'Médico') return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteRecepcao({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_RECEPCAO.includes(funcao)) return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteEnfermagem({ children }) {
  const { funcao } = useAuth();
  if (!FUNCOES_ENFERMAGEM.includes(funcao)) return <Navigate to="/pacientes" replace />;
  return children;
}

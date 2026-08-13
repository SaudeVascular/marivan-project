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
  const { user, loading, perfilPronto } = useAuth();
  // `user && !perfilPronto`: sessão já confirmada, mas a função (Médico,
  // Administrador etc.) ainda não tem resposta definitiva — sem esperar
  // aqui, os guards de função (SomenteAdmin e companhia) leem `funcao`
  // como null nesse intervalo e mandam pra /pacientes mesmo quando o
  // usuário tem a permissão certa (reproduzido no reload de /usuarios
  // logado como Administrador: os eventos de sessão do Supabase disparam
  // fora de ordem e uma leitura de perfil intermediária pode chegar
  // vazia antes da definitiva).
  if (loading || (user && !perfilPronto)) {
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

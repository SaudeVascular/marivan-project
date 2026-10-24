import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  FUNCOES_FINANCEIRO,
  FUNCOES_RECEPCAO,
  podeEmitir,
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
        <p style={{ color: '#666', fontSize: '18px' }}>Carregando...</p>
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
  const { temAcessoClinico } = useAuth();
  if (!temAcessoClinico) return <Navigate to="/pacientes" replace />;
  return children;
}

export function SomenteMedico({ children }) {
  const { funcaoClinicaEfetiva } = useAuth();
  if (funcaoClinicaEfetiva !== 'Médico') return <Navigate to="/pacientes" replace />;
  return children;
}

// Telas de um tipo de documento (ex. Atestado): abre para quem o banco
// deixa registrar esse tipo — ver podeEmitir em constants/roles.
export function SomenteQuemEmite({ tipo, children }) {
  const { funcaoClinicaEfetiva } = useAuth();
  if (!podeEmitir(funcaoClinicaEfetiva, tipo)) return <Navigate to="/pacientes" replace />;
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
  const { funcao, temAcessoClinico } = useAuth();
  // Enfermeiro(a) real, ou Administrador com qualquer papel clínico
  // concedido (suporte/teste — igual já valia antes da migração 30, só
  // que agora exige concessão explícita em vez de ser automático).
  if (!(funcao === 'Enfermeiro(a)' || (funcao === 'Administrador' && temAcessoClinico))) {
    return <Navigate to="/pacientes" replace />;
  }
  return children;
}

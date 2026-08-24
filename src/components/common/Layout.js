import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { calcularIdade } from '../../utils/formatters';
import { comTimeout } from '../../utils/comTimeout';
import { FUNCOES_RECEPCAO, FUNCOES_ENFERMAGEM, FUNCOES_FINANCEIRO } from '../../constants/roles';

// Usa a logomarca cadastrada em Configurações da Clínica (logo_url); sem
// ela, cai no ícone genérico abaixo — nunca deve ficar em branco no
// cabeçalho de um documento impresso.
export function LogoClinica({ size = 44 }) {
  const { clinica } = useClinica();
  if (clinica.logoUrl) {
    return (
      <img
        src={clinica.logoUrl}
        alt={clinica.nome}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%' }}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#1d4ed8" />
      <path d="M50 78 C50 78 20 60 20 40 C20 29 29 22 38 22 C43 22 48 25 50 28 C52 25 57 22 62 22 C71 22 80 29 80 40 C80 60 50 78 50 78Z" fill="white" />
      <rect x="44" y="35" width="12" height="28" rx="3" fill="#1d4ed8" />
      <rect x="36" y="43" width="28" height="12" rx="3" fill="#1d4ed8" />
    </svg>
  );
}

export function CabecalhoImpresso({ paciente }) {
  const { clinica } = useClinica();
  const idade = paciente ? calcularIdade(paciente.nascimento) : null;
  return (
    <div style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: '12px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
        <LogoClinica size={52} />
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#1d4ed8', fontWeight: '800', letterSpacing: '0.5px' }}>{clinica.nome}</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>{clinica.nomeFantasia}</p>
        </div>
      </div>
      {paciente && (
        <div style={{ backgroundColor: '#eff6ff', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
          <span><strong>Paciente:</strong> {paciente.nome}</span>
          {idade !== null && <span><strong>Idade:</strong> {idade} anos</span>}
          {paciente.cpf && <span><strong>CPF:</strong> {paciente.cpf}</span>}
        </div>
      )}
    </div>
  );
}

export function RodapeImpresso() {
  const { clinica } = useClinica();
  return (
    <div style={{ borderTop: '1px solid #ddd', marginTop: '40px', paddingTop: '10px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
      <p style={{ margin: '2px 0' }}>{clinica.endereco}{clinica.cep ? ` — CEP ${clinica.cep}` : ''}</p>
      <p style={{ margin: '2px 0' }}>{clinica.cidade}</p>
      <p style={{ margin: '2px 0' }}>
        {clinica.telefone}
        {clinica.cnpj && ` — CNPJ ${clinica.cnpj}`}
      </p>
    </div>
  );
}

export function Header() {
  const { logout, user, funcao } = useAuth();
  const navigate = useNavigate();
  const [saindo, setSaindo] = React.useState(false);

  const handleLogout = async () => {
    setSaindo(true);
    try {
      await comTimeout(logout(), 6000);
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setSaindo(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="pep-header">
      <div>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PEP - Prontuário Eletrônico</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.85 }}>Sistema médico</p>
      </div>
      <div className="pep-header-right">
        <span className="pep-header-email" style={{ fontSize: '13px', opacity: 0.85 }}>{user?.email}</span>
        <Link to="/minha-conta" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          👤 Minha conta
        </Link>
        <Link to="/pacientes" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          🧑‍🤝‍🧑 Pacientes
        </Link>
        <Link to="/agenda" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          📅 Agenda
        </Link>
        {FUNCOES_RECEPCAO.includes(funcao) && (
          <Link to="/recepcao" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            🛎️ Recepção
          </Link>
        )}
        {FUNCOES_ENFERMAGEM.includes(funcao) && (
          <Link to="/enfermagem" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            🩺 Enfermagem
          </Link>
        )}
        {(FUNCOES_FINANCEIRO.includes(funcao) || funcao === 'Médico') && (
          <Link to="/financeiro" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            💰 Financeiro
          </Link>
        )}
        {funcao === 'Administrador' && (
          <Link to="/painel" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            ⚙️ Administração
          </Link>
        )}
        <button
          onClick={handleLogout}
          disabled={saindo}
          style={{
            padding: '6px 14px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            cursor: saindo ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            opacity: saindo ? 0.7 : 1
          }}
        >
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </div>
  );
}

export const painelStyle = {
  backgroundColor: 'white',
  padding: '18px',
  borderRadius: '10px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export const atalhoStyle = {
  display: 'block',
  textAlign: 'center',
  padding: '16px',
  backgroundColor: '#007bff',
  color: 'white',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: 'bold'
};

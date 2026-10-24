import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { calcularIdade } from '../../utils/formatters';
import { comTimeout } from '../../utils/comTimeout';
import { FUNCOES_RECEPCAO, FUNCOES_FINANCEIRO } from '../../constants/roles';
import { URL_LOGO_PEP } from '../../utils/logoPep';

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
    <div className="cabecalho-impresso" style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: '12px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
        <LogoClinica size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#1d4ed8', fontWeight: '800', letterSpacing: '0.5px' }}>{clinica.nome}</h1>
          <p style={{ margin: 0, fontSize: '16px', color: '#555' }}>{clinica.nomeFantasia}</p>
        </div>
        <LogoPep altura={44} impresso />
      </div>
      {paciente && (
        <div style={{ backgroundColor: '#eff6ff', borderRadius: '6px', padding: '7px 12px', fontSize: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
          <span><strong>Paciente:</strong> {paciente.nome}</span>
          {idade !== null && <span><strong>Idade:</strong> {idade} anos</span>}
          {paciente.cpf && <span><strong>CPF:</strong> {paciente.cpf}</span>}
        </div>
      )}
    </div>
  );
}

// `position: fixed` só entra em @media print (ver index.css) — na tela
// continua no fluxo normal, como sempre foi. Impresso, repete no rodapé
// de TODA página (não só a última) e fica sempre na borda inferior da
// área útil, sem depender de quanto texto veio antes.
export function RodapeImpresso() {
  const { clinica } = useClinica();
  return (
    <div className="rodape-impresso" style={{ borderTop: '1px solid #ddd', marginTop: '40px', paddingTop: '10px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
      <p style={{ margin: '2px 0' }}>{clinica.endereco}{clinica.cep ? ` — CEP ${clinica.cep}` : ''}</p>
      <p style={{ margin: '2px 0' }}>{clinica.cidade}</p>
      <p style={{ margin: '2px 0' }}>
        {clinica.telefone}
        {clinica.cnpj && ` — CNPJ ${clinica.cnpj}`}
      </p>
    </div>
  );
}

// Logomarca do PEP no canto direito do cabeçalho (a da clínica fica à
// esquerda). Lida de public/logo-pep.png; enquanto o arquivo não existir,
// mostra um espaço reservado com "PEP" em vez de uma imagem quebrada.
// `impresso`: versão para fundo branco (pré-visualização dos documentos,
// igual ao canto superior direito do PDF gerado em utils/documentoPdf).
function LogoPep({ altura = 40, impresso = false }) {
  const [semArquivo, setSemArquivo] = React.useState(false);
  if (semArquivo && impresso) {
    return (
      <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8' }}>PEP</div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>Prontuário Eletrônico</div>
      </div>
    );
  }
  if (semArquivo) {
    return (
      <div className="pep-header-logo-pep" title="Logomarca do PEP: coloque o arquivo em public/logo-pep.png"
        style={{ height: altura, minWidth: altura * 1.6, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.6)', borderRadius: '6px', fontWeight: 800, fontSize: '16px', letterSpacing: '1px' }}>
        PEP
      </div>
    );
  }
  return (
    <img className="pep-header-logo-pep" src={URL_LOGO_PEP} alt="PEP"
      onError={() => setSemArquivo(true)}
      style={{ height: altura, maxWidth: altura * 3, objectFit: 'contain' }} />
  );
}

export function Header() {
  const { logout, user, funcao, temAcessoClinico } = useAuth();
  const { clinica } = useClinica();
  const navigate = useNavigate();
  const [saindo, setSaindo] = React.useState(false);

  const handleLogout = async () => {
    setSaindo(true);
    try {
      await comTimeout(logout(), 6000);
    } catch (err) {
      console.error('Erro ao sair:', err?.message || err);
    } finally {
      setSaindo(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="pep-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span style={{ display: 'flex', backgroundColor: 'white', borderRadius: '50%', padding: '2px', flexShrink: 0 }}>
          <LogoClinica size={40} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>{clinica.nome || clinica.nomeFantasia || 'Clínica'}</h1>
          {clinica.nome && clinica.nomeFantasia && clinica.nomeFantasia !== clinica.nome && <p style={{ margin: '4px 0 0', fontSize: '15px', opacity: 0.85 }}>{clinica.nomeFantasia}</p>}
        </div>
      </div>
      <div className="pep-header-right">
        <span className="pep-header-email" style={{ fontSize: '15px', opacity: 0.85 }}>{user?.email}</span>
        <Link to="/minha-conta" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          👤 Minha conta
        </Link>
        <Link to="/pacientes" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          🧑‍🤝‍🧑 Pacientes
        </Link>
        <Link to="/agenda" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          📅 Agenda
        </Link>
        {FUNCOES_RECEPCAO.includes(funcao) && (
          <Link to="/recepcao" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            🛎️ Recepção
          </Link>
        )}
        {(funcao === 'Enfermeiro(a)' || (funcao === 'Administrador' && temAcessoClinico)) && (
          <Link to="/enfermagem" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            🩺 Enfermagem
          </Link>
        )}
        {(FUNCOES_FINANCEIRO.includes(funcao) || funcao === 'Médico') && (
          <Link to="/financeiro" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
            💰 Financeiro
          </Link>
        )}
        {funcao === 'Administrador' && (
          <Link to="/painel" style={{ fontSize: '15px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
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
            fontSize: '15px',
            opacity: saindo ? 0.7 : 1
          }}
        >
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
        <div className="pep-header-sistema" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.35)' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>PEP - Prontuário Eletrônico</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>Sistema médico</div>
          </div>
          <LogoPep />
        </div>
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
  padding: '9px 12px',
  fontSize: '15px',
  backgroundColor: '#007bff',
  color: 'white',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: 'bold'
};

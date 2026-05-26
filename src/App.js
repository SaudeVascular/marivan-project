import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useParams
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './components/Login';
import { pacientesService } from './services/pacientes.service';
import { registrosService } from './services/registros.service';
import { usuariosService } from './services/usuarios.service';

const initialPacientes = [
  {
    id: 1,
    nome: 'Maria Silva Santos',
    cpf: '123.456.789-00',
    nascimento: '1985-03-15',
    telefone: '(11) 99999-9999',
    convenio: 'Unimed',
    alergias: 'Penicilina',
    medicamentos: 'Losartana 50mg',
    evolucoes: ['Paciente hipertensa controlada.']
  },
  {
    id: 2,
    nome: 'José Oliveira Lima',
    cpf: '987.654.321-00',
    nascimento: '1970-08-22',
    telefone: '(11) 98888-8888',
    convenio: 'Particular',
    alergias: 'Nega alergias',
    medicamentos: 'Metformina 850mg',
    evolucoes: ['Paciente diabético tipo 2 em acompanhamento.']
  }
];

const formatarData = (dataISO) => {
  if (!dataISO) return '-';
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const calcularIdade = (nascimento) => {
  if (!nascimento) return null;
  const hoje = new Date();
  const nasc = new Date(nascimento + 'T12:00:00');
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

const CLINICA = {
  nome: 'Clínica CardioVida',
  subtitulo: 'Cardiologia & Medicina Interna',
  endereco: 'Av. das Palmeiras, 1234 — Sala 501 — Jardim América',
  cidade: 'São Paulo — SP — CEP 01310-100',
  telefone: 'Tel.: (11) 3456-7890 | cardiovida@clinica.com.br',
};

const LogoClinica = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#1d4ed8" />
    <path d="M50 78 C50 78 20 60 20 40 C20 29 29 22 38 22 C43 22 48 25 50 28 C52 25 57 22 62 22 C71 22 80 29 80 40 C80 60 50 78 50 78Z" fill="white" />
    <rect x="44" y="35" width="12" height="28" rx="3" fill="#1d4ed8" />
    <rect x="36" y="43" width="28" height="12" rx="3" fill="#1d4ed8" />
  </svg>
);

function CabecalhoImpresso({ paciente }) {
  const idade = paciente ? calcularIdade(paciente.nascimento) : null;
  return (
    <div style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: '12px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
        <LogoClinica size={52} />
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#1d4ed8', fontWeight: '800', letterSpacing: '0.5px' }}>{CLINICA.nome}</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>{CLINICA.subtitulo}</p>
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

function RodapeImpresso() {
  return (
    <div style={{ borderTop: '1px solid #ddd', marginTop: '40px', paddingTop: '10px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
      <p style={{ margin: '2px 0' }}>{CLINICA.endereco}</p>
      <p style={{ margin: '2px 0' }}>{CLINICA.cidade}</p>
      <p style={{ margin: '2px 0' }}>{CLINICA.telefone}</p>
    </div>
  );
}

const EXAMES_DISPONIVEIS = [
  {
    categoria: 'Laboratório — Rotina',
    exames: [
      { id: 'hemograma',  nome: 'Hemograma completo',               tuss: '40303289' },
      { id: 'glicemia',   nome: 'Glicemia de jejum',                tuss: '40302032' },
      { id: 'hba1c',      nome: 'Hemoglobina glicada (HbA1c)',      tuss: '40302024' },
      { id: 'col',        nome: 'Colesterol total e frações',       tuss: '40302059' },
      { id: 'trig',       nome: 'Triglicerídeos',                   tuss: '40302121' },
      { id: 'creat',      nome: 'Creatinina',                       tuss: '40302067' },
      { id: 'ureia',      nome: 'Ureia',                            tuss: '40302130' },
      { id: 'acur',       nome: 'Ácido úrico',                      tuss: '40302016' },
      { id: 'sodio',      nome: 'Sódio',                            tuss: '40302113' },
      { id: 'potassio',   nome: 'Potássio',                         tuss: '40302091' },
      { id: 'magnesio',   nome: 'Magnésio',                         tuss: '40302075' },
      { id: 'tgo',        nome: 'TGO (AST)',                        tuss: '40302105' },
      { id: 'tgp',        nome: 'TGP (ALT)',                        tuss: '40302113' },
      { id: 'pcr',        nome: 'Proteína C reativa (PCR)',         tuss: '40302091' },
      { id: 'tsh',        nome: 'TSH',                              tuss: '40302210' },
      { id: 't4l',        nome: 'T4 livre',                         tuss: '40302202' },
    ],
  },
  {
    categoria: 'Laboratório — Cardiológico',
    exames: [
      { id: 'troponina',  nome: 'Troponina I ou T',                 tuss: '40302229' },
      { id: 'bnp',        nome: 'BNP / NT-proBNP',                  tuss: '40302350' },
      { id: 'ddi',        nome: 'D-dímero',                         tuss: '40302270' },
      { id: 'coag',       nome: 'Coagulograma (TAP / INR / TTPA)',  tuss: '40303157' },
      { id: 'ferrit',     nome: 'Ferritina',                        tuss: '40302044' },
      { id: 'vitd',       nome: 'Vitamina D (25-OH)',               tuss: '40302563' },
    ],
  },
  {
    categoria: 'Cardiologia',
    exames: [
      { id: 'ecg',        nome: 'Eletrocardiograma (ECG)',          tuss: '40301010' },
      { id: 'eco',        nome: 'Ecocardiograma transtorácico',     tuss: '40901254' },
      { id: 'ergom',      nome: 'Teste ergométrico',                tuss: '40301052' },
      { id: 'holter',     nome: 'Holter 24 horas',                  tuss: '40301036' },
      { id: 'mapa',       nome: 'MAPA 24 horas',                    tuss: '40301028' },
      { id: 'cinti',      nome: 'Cintilografia miocárdica',         tuss: '40801293' },
      { id: 'angiotc',    nome: 'Angiotomografia coronariana',      tuss: '40901122' },
      { id: 'rmcard',     nome: 'Ressonância magnética cardíaca',   tuss: '40914153' },
    ],
  },
  {
    categoria: 'Imagem',
    exames: [
      { id: 'rxtorax',    nome: 'Radiografia de tórax',            tuss: '40901130' },
      { id: 'usgabd',     nome: 'Ultrassom de abdome total',        tuss: '40901041' },
      { id: 'dopcar',     nome: 'Doppler de carótidas e vertebrais',tuss: '40901386' },
      { id: 'dopvein',    nome: 'Doppler venoso de MMII',           tuss: '40901203' },
      { id: 'itb',        nome: 'Índice tornozelo-braquial (ITB)', tuss: '40301079' },
    ],
  },
];

function Header() {
  const { logout, user } = useAuth();
  return (
    <div className="pep-header">
      <div>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PEP - Prontuário Eletrônico</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.85 }}>Sistema médico</p>
      </div>
      <div className="pep-header-right">
        <span className="pep-header-email" style={{ fontSize: '13px', opacity: 0.85 }}>{user?.email}</span>
        <Link to="/usuarios" style={{ fontSize: '13px', color: 'white', opacity: 0.9, textDecoration: 'none', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px' }}>
          👥 Usuários
        </Link>
        <button
          onClick={logout}
          style={{
            padding: '6px 14px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }) {
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

function PacientesPage({ pacientes, setPacientes }) {
  const navigate = useNavigate();

  const [busca, setBusca] = React.useState('');
  const [pacienteEditando, setPacienteEditando] = React.useState(null);

  const formatarCPF = (valor) => {
    const numeros = valor.replace(/\D/g, '').slice(0, 11);
    return numeros
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const limparCPF = (cpf) => (cpf || '').replace(/\D/g, '');

  const formatarTelefone = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 11);
    if (n.length === 0) return '';
    if (n.length <= 2) return `(${n}`;
    if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  const formatarCEP = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  const buscarCEP = async (cepFormatado) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const partes = [data.logradouro, data.bairro, data.localidade].filter(Boolean);
        const endereco = `${partes.join(', ')} - ${data.uf}`;
        setNovoPaciente(prev => ({ ...prev, endereco }));
      }
    } catch (_) {}
  };

  const [novoPaciente, setNovoPaciente] = React.useState({
    nome: '',
    cpf: '',
    nascimento: '',
    nomeMae: '',
    telefone: '',
    convenio: '',
    cep: '',
    endereco: '',
    alergias: ''
  });

  const pacientesFiltrados = pacientes
    .filter((paciente) =>
      (paciente.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (paciente.cpf || '').includes(busca) ||
      (paciente.nascimento || '').includes(busca) ||
      (paciente.nomeMae || '').toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const limparFormulario = () => {
    setNovoPaciente({
      nome: '',
      cpf: '',
      nascimento: '',
      nomeMae: '',
      telefone: '',
      convenio: '',
      cep: '',
      endereco: '',
      alergias: ''
    });
    setPacienteEditando(null);
  };

  const salvarPaciente = async () => {
    const temIdentificador =
      novoPaciente.cpf || novoPaciente.nascimento || novoPaciente.nomeMae;

    if (!novoPaciente.nome || !temIdentificador || !novoPaciente.telefone) {
      alert('Preencha o nome do paciente, telefone e pelo menos um destes dados: CPF, data de nascimento ou nome da mãe.');
      return;
    }

    const cpfAtual = limparCPF(novoPaciente.cpf);
    if (cpfAtual) {
      const cpfDuplicado = pacientes.some((p) =>
        limparCPF(p.cpf) === cpfAtual && p.id !== pacienteEditando?.id
      );
      if (cpfDuplicado) {
        alert('Já existe um paciente cadastrado com este CPF.');
        return;
      }
    }

    try {
      if (pacienteEditando) {
        const atualizado = await pacientesService.atualizar(pacienteEditando.id, novoPaciente);
        setPacientes(pacientes.map((p) =>
          p.id === pacienteEditando.id ? { ...p, ...atualizado, registros: p.registros } : p
        ));
      } else {
        const criado = await pacientesService.criar(novoPaciente);
        setPacientes([...pacientes, { ...criado, registros: [] }]);
      }
      limparFormulario();
    } catch (err) {
      alert('Erro ao salvar paciente: ' + err.message);
    }
  };

  const editarPaciente = (paciente) => {
    setPacienteEditando(paciente);

    setNovoPaciente({
      nome: paciente.nome || '',
      cpf: paciente.cpf || '',
      nascimento: paciente.nascimento || '',
      nomeMae: paciente.nomeMae || '',
      telefone: paciente.telefone || '',
      convenio: paciente.convenio || '',
      cep: paciente.cep || '',
      endereco: paciente.endereco || '',
      alergias: paciente.alergias || ''
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <Header />

      <h2>Cadastro de Pacientes</h2>

      <div
        style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          position: 'sticky',
          top: '0',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {pacienteEditando ? 'Editar Paciente' : 'Novo Paciente'}
        </h3>

        <div className="form-grid-paciente">
          <input
            placeholder="Nome completo *"
            value={novoPaciente.nome}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, nome: e.target.value })}
            style={{ padding: '10px', gridColumn: 'span 4' }}
          />
          <input
            placeholder="CPF"
            value={novoPaciente.cpf}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, cpf: formatarCPF(e.target.value) })}
            style={{ padding: '10px', gridColumn: 'span 2' }}
          />
          <input
            type="date"
            value={novoPaciente.nascimento}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, nascimento: e.target.value })}
            style={{ padding: '10px', gridColumn: 'span 2' }}
          />
          <input
            placeholder="Nome da mãe"
            value={novoPaciente.nomeMae}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, nomeMae: e.target.value })}
            style={{ padding: '10px', gridColumn: 'span 4' }}
          />
          <input
            placeholder="(XX) XXXXX-XXXX"
            value={novoPaciente.telefone}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, telefone: formatarTelefone(e.target.value) })}
            style={{ padding: '10px', gridColumn: 'span 2' }}
          />
          <input
            placeholder="CEP"
            value={novoPaciente.cep}
            onChange={(e) => {
              const cepFormatado = formatarCEP(e.target.value);
              setNovoPaciente(prev => ({ ...prev, cep: cepFormatado }));
              buscarCEP(cepFormatado);
            }}
            style={{ padding: '10px', gridColumn: 'span 2' }}
            maxLength={9}
          />
          <input
            placeholder="Endereço (preenchido pelo CEP)"
            value={novoPaciente.endereco}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, endereco: e.target.value })}
            style={{ padding: '10px', gridColumn: 'span 6' }}
          />
          <input
            placeholder="Convênio"
            value={novoPaciente.convenio}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, convenio: e.target.value })}
            list="lista-convenios"
            style={{ padding: '10px', gridColumn: 'span 2' }}
          />
          <datalist id="lista-convenios">
            <option value="Bradesco Saúde" />
            <option value="CASSI" />
            <option value="Unimed" />
            <option value="Particular" />
          </datalist>
          <input
            placeholder="Alergias"
            value={novoPaciente.alergias}
            onChange={(e) => setNovoPaciente({ ...novoPaciente, alergias: e.target.value })}
            style={{ padding: '10px', gridColumn: 'span 9' }}
          />
          <button
            onClick={salvarPaciente}
            style={{ padding: '12px', backgroundColor: pacienteEditando ? '#f59e0b' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 3' }}
          >
            {pacienteEditando ? 'Salvar Alterações' : 'Salvar Paciente'}
          </button>
          {pacienteEditando && (
            <button
              onClick={limparFormulario}
              style={{ padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 12' }}
            >
              Cancelar Edição
            </button>
          )}
        </div>

        <p style={{ fontSize: '13px', color: '#666', margin: '10px 0 0' }}>
          * Obrigatório: nome, telefone e pelo menos CPF, data de nascimento ou nome da mãe.
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px'
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: pacienteEditando ? '255px' : '205px',
            zIndex: 15,
            backgroundColor: 'white',
            padding: '10px 0 15px',
            borderBottom: '1px solid #eee'
          }}
        >
          <h3 style={{ marginTop: 0 }}>Lista de Pacientes</h3>

          <input
            placeholder="Buscar por nome, CPF, data de nascimento ou nome da mãe..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginTop: '15px', display: 'grid', gap: '8px' }}>
          {pacientesFiltrados.length === 0 ? (
            <p>Nenhum paciente encontrado.</p>
          ) : (
            pacientesFiltrados.map((paciente) => (
              <div
                key={paciente.id}
                style={{
                  border: '1px solid #ddd',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div className="paciente-row-1">
                  <div>
                    <strong>{paciente.nome}</strong>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      Mãe: {paciente.nomeMae || 'Não informado'}
                    </div>
                  </div>

                  <div style={{ fontSize: '13px' }}>
                    <strong>CPF:</strong><br />
                    {paciente.cpf || '-'}
                  </div>

                  <div style={{ fontSize: '13px' }}>
                    <strong>Nasc.:</strong><br />
                    {formatarData(paciente.nascimento)}
                  </div>

                  <div style={{ fontSize: '13px' }}>
                    <strong>Tel.:</strong><br />
                    {paciente.telefone || '-'}
                  </div>
                </div>

                <div className="paciente-row-2">
                  <div>
                    <strong>Convênio:</strong> {paciente.convenio || '-'}
                  </div>

                  <div>
                    <strong>Endereço:</strong> {paciente.endereco || '-'}
                  </div>

                  <div>
                    <strong>Alergias:</strong> {paciente.alergias || '-'}
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button
                    onClick={() => navigate(`/prontuario/${paciente.id}`)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Abrir Prontuário
                  </button>

                  <button
                    onClick={() => editarPaciente(paciente)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Editar Cadastro
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProntuarioPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const [atendimentoAtual, setAtendimentoAtual] = React.useState('');
  const [registroAberto, setRegistroAberto] = React.useState(null);
  const [registroEditando, setRegistroEditando] = React.useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [editandoClinicos, setEditandoClinicos] = React.useState(false);
  const [splitPct, setSplitPct] = React.useState(55);
  const isDragging = React.useRef(false);
  const splitContainerRef = React.useRef(null);

  React.useEffect(() => {
    const onMove = (clientX) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(Math.max(pct, 25), 75));
    };
    const onMouseMove = (e) => onMove(e.clientX);
    const onTouchMove = (e) => onMove(e.touches[0].clientX);
    const onEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);
  const [clinicos, setClinicos] = React.useState({
    has: '', dm: '', dac: '', dislipidemia: '',
    tabagismo: '', etilismo: '', cirurgias: '',
    medicamentosUso: '', alergias: ''
  });

  React.useEffect(() => {
    if (paciente) {
      setClinicos({
        has: paciente.has || '',
        dm: paciente.dm || '',
        dac: paciente.dac || '',
        dislipidemia: paciente.dislipidemia || '',
        tabagismo: paciente.tabagismo || '',
        etilismo: paciente.etilismo || '',
        cirurgias: paciente.cirurgias || '',
        medicamentosUso: paciente.medicamentosUso || '',
        alergias: paciente.alergias || '',
      });
      // Carrega histórico do banco se ainda não carregou
      if (!paciente.registros?.length) {
        registrosService.listarPorPaciente(paciente.id)
          .then(registros => setPacientes(prev =>
            prev.map(p => p.id === paciente.id ? { ...p, registros } : p)
          ))
          .catch(err => console.error('Erro ao carregar histórico:', err));
      }
    }
  }, [paciente?.id]);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const registros = paciente.registros || [];

  const salvarAtendimento = async () => {
    if (!atendimentoAtual.trim()) return;
    const agora = new Date();
    const registroLocal = {
      tipo: 'Consulta',
      titulo: 'Atendimento médico',
      conteudo: atendimentoAtual,
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    try {
      const salvo = await registrosService.criar(registroLocal, paciente.id, user?.id);
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [salvo, ...(p.registros || [])] } : p
      ));
    } catch (err) {
      console.error('Erro ao salvar atendimento:', err);
      // fallback local
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [{ id: Date.now(), ...registroLocal, data: agora.toLocaleDateString('pt-BR') }, ...(p.registros || [])] } : p
      ));
    }
    setAtendimentoAtual('');
  };

  const salvarEdicaoRegistro = async () => {
    if (!registroEditando) return;
    setSalvandoEdicao(true);
    try {
      const atualizado = await registrosService.atualizar(registroEditando.id, registroEditando);
      setPacientes(pacientes.map(p =>
        p.id === paciente.id
          ? { ...p, registros: p.registros.map(r => r.id === atualizado.id ? atualizado : r) }
          : p
      ));
      setRegistroEditando(null);
    } catch (err) {
      alert('Erro ao salvar edição: ' + err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const salvarClinicos = async (novoClinicos = clinicos) => {
    try {
      await pacientesService.atualizar(paciente.id, { ...paciente, ...novoClinicos });
      setPacientes(pacientes.map((p) => p.id === paciente.id ? { ...p, ...novoClinicos } : p));
    } catch (err) {
      console.error('Erro ao salvar dados clínicos:', err);
    }
    setEditandoClinicos(false);
  };

  const toggleComorbidade = (key, ciclo) => {
    if (!editandoClinicos) return;
    const idx = ciclo.indexOf(clinicos[key]);
    const proximo = ciclo[(idx + 1) % ciclo.length];
    setClinicos(prev => ({ ...prev, [key]: proximo }));
  };

  const campoSelect = (label, key, extras = []) => (
    <div key={key} style={{ marginBottom: '6px' }}>
      <strong style={{ fontSize: '12px' }}>{label}: </strong>
      {editandoClinicos ? (
        <select
          value={clinicos[key]}
          onChange={(e) => setClinicos({ ...clinicos, [key]: e.target.value })}
          style={{ fontSize: '12px', padding: '1px 4px' }}
        >
          <option value="">Não informado</option>
          <option value="Sim">Sim</option>
          <option value="Não">Não</option>
          <option value="Em investigação">Em investigação</option>
          {extras.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span style={{ fontSize: '12px', color: clinicos[key] ? '#333' : '#999' }}>
          {clinicos[key] || 'Não informado'}
        </span>
      )}
    </div>
  );

  const coresTipo = {
    'Consulta': '#007bff', 'Atestado': '#28a745',
    'Receituário': '#f59e0b', 'Prescrição': '#8b5cf6', 'Relatório': '#6c757d',
    'Pedido de Exames': '#0891b2',
    'Laudo': '#7c3aed',
  };

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar para pacientes</Link>
      {/* Faixa horizontal fixa: dados do paciente + dados clínicos */}
      <div style={{ ...painelStyle, marginTop: '16px', display: 'flex', gap: '0', alignItems: 'flex-start', flexWrap: 'wrap', position: 'sticky', top: '0', zIndex: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>

        {/* Identificação do paciente */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', paddingRight: '20px', flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>👤</div>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px' }}>{paciente.nome}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '12px', color: '#555' }}>
              <span><strong>CPF:</strong> {paciente.cpf || '-'}</span>
              <span><strong>Nasc.:</strong> {formatarData(paciente.nascimento)}{paciente.nascimento ? ` (${calcularIdade(paciente.nascimento)} anos)` : ''}</span>
              <span><strong>Tel.:</strong> {paciente.telefone || '-'}</span>
              <span><strong>Convênio:</strong> {paciente.convenio || '-'}</span>
            </div>
          </div>
        </div>

        {/* Separador vertical */}
        <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#e5e7eb', margin: '0 20px', flexShrink: 0 }} />

        {/* Dados clínicos */}
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '13px' }}>Dados Clínicos</strong>
            <div style={{ display: 'flex', gap: '4px' }}>
              {editandoClinicos && (
                <button onClick={() => setEditandoClinicos(false)} style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
              )}
              <button
                onClick={() => editandoClinicos ? salvarClinicos() : setEditandoClinicos(true)}
                style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: editandoClinicos ? '#28a745' : '#6c757d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                {editandoClinicos ? '✓ Salvar' : 'Editar'}
              </button>
            </div>
          </div>

          {/* Botões de comorbidade — clique para ativar/desativar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {[
              { key: 'has',          label: 'HAS',         ciclo: ['', 'Sim', 'Não'] },
              { key: 'dm',           label: 'DM',          ciclo: ['', 'Sim', 'Não'] },
              { key: 'dac',          label: 'DAC',         ciclo: ['', 'Sim', 'Não'] },
              { key: 'dislipidemia', label: 'Dislipidemia',ciclo: ['', 'Sim', 'Não'] },
              { key: 'tabagismo',    label: 'Tabagismo',   ciclo: ['', 'Sim', 'Ex-tabagista'] },
              { key: 'etilismo',     label: 'Etilismo',    ciclo: ['', 'Sim', 'Ocasional'] },
            ].map(({ key, label, ciclo }) => {
              const valor = clinicos[key];
              const ativo   = valor === 'Sim';
              const especial = valor === 'Ex-tabagista' || valor === 'Ocasional';
              const bg    = ativo ? '#dc2626' : especial ? '#f59e0b' : '#f1f5f9';
              const color = (ativo || especial) ? 'white' : '#64748b';
              const border = ativo ? '#b91c1c' : especial ? '#d97706' : '#e2e8f0';
              return (
                <button
                  key={key}
                  onClick={() => toggleComorbidade(key, ciclo)}
                  disabled={!editandoClinicos}
                  title={!editandoClinicos ? 'Clique em Editar para alterar' : especial ? valor : ativo ? 'Clique para alterar' : 'Clique para ativar'}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: bg,
                    color,
                    border: `1px solid ${border}`,
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: ativo || especial ? '700' : '400',
                    cursor: editandoClinicos ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    opacity: editandoClinicos ? 1 : 0.85,
                  }}
                >
                  {especial ? `${label} · ${valor}` : label}
                </button>
              );
            })}
          </div>

          {/* Cirurgias, Medicamentos, Alergias em linha */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: '12px' }}>
            <div>
              <strong>Cirurgias: </strong>
              {editandoClinicos
                ? <input value={clinicos.cirurgias} onChange={e => setClinicos({ ...clinicos, cirurgias: e.target.value })} placeholder="Ex: Apendicectomia 2010" style={{ fontSize: '12px', padding: '2px 4px', width: '160px' }} />
                : <span style={{ color: clinicos.cirurgias ? '#333' : '#999' }}>{clinicos.cirurgias || '-'}</span>
              }
            </div>
            <div>
              <strong>Medicamentos: </strong>
              {editandoClinicos
                ? <input value={clinicos.medicamentosUso} onChange={e => setClinicos({ ...clinicos, medicamentosUso: e.target.value })} style={{ fontSize: '12px', padding: '2px 4px', width: '200px' }} />
                : <span style={{ color: clinicos.medicamentosUso ? '#333' : '#999' }}>{clinicos.medicamentosUso || '-'}</span>
              }
            </div>
            <div>
              <strong>Alergias: </strong>
              {editandoClinicos
                ? <input value={clinicos.alergias} onChange={e => setClinicos({ ...clinicos, alergias: e.target.value })} style={{ fontSize: '12px', padding: '2px 4px', width: '140px' }} />
                : <span style={{ color: clinicos.alergias ? '#dc3545' : '#999', fontWeight: clinicos.alergias ? 'bold' : 'normal' }}>{clinicos.alergias || '-'}</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div ref={splitContainerRef} style={{ marginTop: '16px', display: 'flex', alignItems: 'stretch', gap: '0', userSelect: isDragging.current ? 'none' : 'auto' }}>

        {/* Painel esquerdo — atendimento atual */}
        <div style={{ ...painelStyle, width: splitPct + '%', borderRadius: '10px 0 0 10px', flexShrink: 0, overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Atendimento Atual</h2>
          <textarea
            placeholder="História clínica, exame físico, hipótese diagnóstica, conduta..."
            value={atendimentoAtual}
            onChange={(e) => setAtendimentoAtual(e.target.value)}
            rows={18}
            style={{ width: '100%', padding: '12px', fontSize: '15px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
          />
          <button onClick={salvarAtendimento} style={{ marginTop: '10px', padding: '12px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ✓ Salvar Atendimento
          </button>
          <div className="atalhos-grid">
            <Link to={`/receituario/${paciente.id}`} style={atalhoStyle}>📋 Receituário</Link>
            <Link to={`/atestados/${paciente.id}`} style={atalhoStyle}>📄 Atestado</Link>
            <Link to={`/prescricao/${paciente.id}`} style={atalhoStyle}>💊 Prescrição</Link>
            <Link to={`/relatorios/${paciente.id}`} style={atalhoStyle}>🩺 Relatório</Link>
            <Link to={`/pedido-exames/${paciente.id}`} style={{ ...atalhoStyle, backgroundColor: '#0891b2' }}>🔬 Pedido de Exames</Link>
            <Link to={`/laudos/${paciente.id}`} style={{ ...atalhoStyle, backgroundColor: '#7c3aed' }}>📝 Laudos</Link>
          </div>
        </div>

        {/* Divisor arrastável */}
        <div
          onMouseDown={(e) => { isDragging.current = true; e.preventDefault(); }}
          onTouchStart={() => { isDragging.current = true; }}
          style={{ width: '10px', cursor: 'col-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', transition: 'background-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          title="Arraste para redimensionar"
        >
          <div style={{ width: '3px', height: '48px', backgroundColor: '#94a3b8', borderRadius: '3px', pointerEvents: 'none' }} />
        </div>

        {/* Painel direito — histórico */}
        <div style={{ ...painelStyle, flex: 1, borderRadius: '0 10px 10px 0', overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Histórico ({registros.length})</h2>
          {registros.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px' }}>Nenhum registro ainda.</p>
          ) : (
            registros.map((registro) => {
              const cor = coresTipo[registro.tipo] || '#007bff';
              const aberto = registroAberto === registro.id;
              const editando = registroEditando?.id === registro.id;
              const dentroDE24h = registro.createdAt
                && (Date.now() - new Date(registro.createdAt).getTime()) < 8 * 60 * 60 * 1000;
              const podeEditar = registro.createdBy === user?.id && dentroDE24h;
              return (
                <div key={registro.id} style={{ marginBottom: '8px' }}>
                  {/* Cabeçalho clicável */}
                  <div
                    onClick={() => !editando && setRegistroAberto(aberto ? null : registro.id)}
                    onDoubleClick={() => !editando && window.open(`/imprimir/${paciente.id}/${registro.id}`, '_blank')}
                    style={{ borderLeft: `4px solid ${cor}`, backgroundColor: aberto || editando ? '#f0f7ff' : '#f8f9fa', padding: '8px 10px', borderRadius: aberto || editando ? '6px 6px 0 0' : '6px', cursor: editando ? 'default' : 'pointer', userSelect: 'none' }}
                    title="Clique para expandir · Duplo clique para imprimir"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', backgroundColor: cor, color: 'white', padding: '1px 7px', borderRadius: '10px' }}>{registro.tipo}</span>
                      <span style={{ fontSize: '11px', color: '#666' }}>{registro.data} {registro.hora}</span>
                    </div>
                    <p style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: '500' }}>{registro.titulo}</p>
                    {!editando && (
                      <small style={{ color: cor, fontSize: '11px' }}>{aberto ? '▲ Fechar' : '▼ Ver detalhes'}</small>
                    )}
                  </div>

                  {/* Conteúdo expandido — modo leitura */}
                  {aberto && !editando && (
                    <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderTop: 'none', padding: '10px 12px', borderRadius: '0 0 6px 6px' }}>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6', maxHeight: '280px', overflowY: 'auto', marginBottom: '8px' }}>
                        {registro.conteudo}
                      </div>
                      {podeEditar && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRegistroEditando({ id: registro.id, titulo: registro.titulo, conteudo: registro.conteudo }); }}
                          style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f0f7ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Modo edição inline */}
                  {editando && (
                    <div style={{ backgroundColor: 'white', border: '1px solid #3b82f6', borderTop: 'none', padding: '12px', borderRadius: '0 0 6px 6px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Título</label>
                        <input
                          value={registroEditando.titulo}
                          onChange={e => setRegistroEditando({ ...registroEditando, titulo: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Conteúdo</label>
                        <textarea
                          value={registroEditando.conteudo}
                          onChange={e => setRegistroEditando({ ...registroEditando, conteudo: e.target.value })}
                          rows={6}
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={salvarEdicaoRegistro}
                          disabled={salvandoEdicao}
                          style={{ padding: '6px 14px', backgroundColor: salvandoEdicao ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoEdicao ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                        >
                          {salvandoEdicao ? 'Salvando...' : '✓ Salvar'}
                        </button>
                        <button
                          onClick={() => setRegistroEditando(null)}
                          style={{ padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AtestadoPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const hojeISO = new Date().toISOString().split('T')[0];

  const [medico, setMedico] = React.useState('');
  const [crm, setCrm] = React.useState('');
  const [dias, setDias] = React.useState('1');
  const [dataAtestado, setDataAtestado] = React.useState(hojeISO);
  const [cid, setCid] = React.useState('');
  const [observacoes, setObservacoes] = React.useState('');
  const [salvo, setSalvo] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const dataFormatada = new Date(dataAtestado + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      `Afastamento: ${dias} ${Number(dias) === 1 ? 'dia' : 'dias'} a partir de ${dataFormatada}`,
      cid ? `CID: ${cid}` : null,
      observacoes ? `Observações: ${observacoes}` : null,
    ].filter(Boolean).join('\n');

    const registro = {
      tipo: 'Atestado',
      titulo: `Atestado — ${dias} ${Number(dias) === 1 ? 'dia' : 'dias'} de afastamento`,
      conteudo,
    };
    try {
      const salvoDb = await registrosService.criar(registro, paciente.id, user?.id);
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
      ));
    } catch (err) {
      console.error('Erro ao salvar atestado:', err);
      const agora = new Date();
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [{ id: Date.now(), ...registro, data: agora.toLocaleDateString('pt-BR'), hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...(p.registros || [])] } : p
      ));
    }
    setSalvo(true);
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '750px', margin: '20px auto' }}>
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Preencher Atestado</h3>
          <div className="form-grid-3col">
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome do Médico</label>
              <input value={medico} onChange={(e) => setMedico(e.target.value)} placeholder="Dr. Nome Sobrenome" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM</label>
              <input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="CRM 12345/SP" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
              <input type="date" value={dataAtestado} onChange={(e) => setDataAtestado(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dias de afastamento</label>
              <input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID (opcional)</label>
              <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: Z00.0" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observações (opcional)</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ width: '100%', padding: '8px' }} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={salvarNoProntuario} style={{ padding: '10px 18px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✓ Salvar no Prontuário
            </button>
            <button onClick={() => window.print()} style={{ padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <h2 style={{ margin: '0 0 2px', fontSize: '16px' }}>{medico || 'Dr. _______________________'}</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>{crm || 'CRM _______________'}</p>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 30px' }}>ATESTADO MÉDICO</h2>
          <p style={{ fontSize: '15px', lineHeight: '2.2', textAlign: 'justify' }}>
            Atesto que o(a) paciente <strong>{paciente.nome}</strong>
            {paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ','} esteve sob meus cuidados médicos
            e necessita afastar-se de suas atividades por{' '}
            <strong>{dias} {Number(dias) === 1 ? 'dia' : 'dias'}</strong>, a contar de {dataFormatada}.
            {cid && ` CID: ${cid}.`}
          </p>
          {observacoes && <p style={{ fontSize: '15px', lineHeight: '2', textAlign: 'justify' }}>{observacoes}</p>}
          <div style={{ marginTop: '60px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

function ReceituarioPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const hojeISO = new Date().toISOString().split('T')[0];

  const [medico, setMedico]           = React.useState('');
  const [crm, setCrm]                 = React.useState('');
  const [dataReceita]                 = React.useState(hojeISO);
  const [salvo, setSalvo]             = React.useState(false);
  const [textoLivre, setTextoLivre]   = React.useState('');
  const [medicamentos, setMedicamentos] = React.useState([
    { id: 1, nome: '', dose: '', quantidade: '', via: '', frequencia: '', duracao: '', instrucoes: '' }
  ]);

  React.useEffect(() => {
    if (user?.id) {
      usuariosService.buscarPerfil(user.id).then(perfil => {
        if (perfil) {
          setMedico(perfil.nome || '');
          setCrm(perfil.crm || '');
        }
      });
    }
  }, [user?.id]);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const adicionarMed = () => setMedicamentos([...medicamentos, {
    id: Date.now(), nome: '', dose: '', quantidade: '', via: '', frequencia: '', duracao: '', instrucoes: ''
  }]);

  const removerMed = (medId) => {
    if (medicamentos.length > 1) setMedicamentos(medicamentos.filter(m => m.id !== medId));
  };

  const atualizarMed = (medId, campo, valor) => {
    setMedicamentos(medicamentos.map(m => m.id === medId ? { ...m, [campo]: valor } : m));
  };

  const dataFormatada = new Date(dataReceita + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const medsTexto = medicamentos
      .filter(m => m.nome)
      .map((m, idx) => {
        const linhas = [`${idx + 1}. ${m.nome}${m.dose ? ' ' + m.dose : ''}`];
        if (m.frequencia || m.duracao) linhas.push(`   ${m.frequencia}${m.duracao ? ' por ' + m.duracao : ''}`);
        if (m.instrucoes) linhas.push(`   ${m.instrucoes}`);
        return linhas.join('\n');
      })
      .join('\n\n');

    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      medsTexto || null,
      textoLivre ? `---\n${textoLivre}` : null,
    ].filter(Boolean).join('\n\n');
    const qtd = medicamentos.filter(m => m.nome).length;
    const registro = {
      tipo: 'Receituário',
      titulo: `Receituário — ${qtd} medicamento${qtd !== 1 ? 's' : ''}`,
      conteudo,
    };
    try {
      const salvoDb = await registrosService.criar(registro, paciente.id, user?.id);
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
      ));
    } catch (err) {
      console.error('Erro ao salvar receituário:', err);
      const agora = new Date();
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [{ id: Date.now(), ...registro, data: agora.toLocaleDateString('pt-BR'), hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...(p.registros || [])] } : p
      ));
    }
    setSalvo(true);
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '780px', margin: '20px auto' }}>
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Receituário</h3>
          <h4 style={{ margin: '0 0 10px' }}>Medicamentos</h4>
          {medicamentos.map((med, idx) => (
            <div key={med.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#374151' }}>Medicamento {idx + 1}</strong>
                {medicamentos.length > 1 && (
                  <button onClick={() => removerMed(med.id)} style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Remover</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Nome do medicamento *" value={med.nome} onChange={(e) => atualizarMed(med.id, 'nome', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Apresentação (ex: 50mg)" value={med.dose} onChange={(e) => atualizarMed(med.id, 'dose', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Quantidade (ex: 2 caixas)" value={med.quantidade} onChange={(e) => atualizarMed(med.id, 'quantidade', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Administração (ex: via oral)" value={med.via} onChange={(e) => atualizarMed(med.id, 'via', e.target.value)} list="lista-vias" style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Frequência (ex: 1x ao dia)" value={med.frequencia} onChange={(e) => atualizarMed(med.id, 'frequencia', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Duração (ex: 30 dias)" value={med.duracao} onChange={(e) => atualizarMed(med.id, 'duracao', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
              </div>
              <datalist id="lista-vias">
                <option value="via oral" />
                <option value="uso tópico" />
                <option value="via sublingual" />
                <option value="via inalatória" />
                <option value="via injetável (IM)" />
                <option value="via injetável (IV)" />
                <option value="via nasal" />
                <option value="via oftálmica" />
                <option value="via retal" />
                <option value="via transdérmica" />
              </datalist>
              <input placeholder="Instruções (ex: tomar após as refeições)" value={med.instrucoes} onChange={(e) => atualizarMed(med.id, 'instrucoes', e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarMed} style={{ padding: '9px 16px', backgroundColor: '#e8f5e9', color: '#28a745', border: '1px solid #c8e6c9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Medicamento</button>
            <button onClick={salvarNoProntuario} style={{ padding: '9px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✓ Salvar no Prontuário</button>
            <button onClick={() => window.print()} style={{ padding: '9px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir</button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>

          {/* Texto livre */}
          <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#374151' }}>
              Texto livre <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>— escreva livremente ou cole uma prescrição</span>
            </label>
            <textarea
              value={textoLivre}
              onChange={e => setTextoLivre(e.target.value)}
              rows={6}
              placeholder="Digite ou cole aqui medicamentos em formato livre..."
              style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
            />
          </div>
        </div>

        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 20px' }}>RECEITUÁRIO</h2>
          <hr style={{ margin: '0 0 20px', borderColor: '#ddd' }} />

          {medicamentos.filter(m => m.nome).length === 0 && !textoLivre && (
            <p style={{ color: '#999', textAlign: 'center', fontStyle: 'italic' }}>Preencha os medicamentos acima</p>
          )}

          {medicamentos.filter(m => m.nome).map((med, idx) => (
            <div key={med.id} style={{ marginBottom: '22px' }}>
              {/* Linha principal: nome (apresentação) ......... quantidade */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px', whiteSpace: 'nowrap' }}>
                  {idx + 1}. {med.nome}{med.dose ? ` (${med.dose})` : ''}
                </span>
                <span style={{ flex: 1, borderBottom: '1px dotted #555', marginBottom: '3px', minWidth: '20px' }} />
                <span style={{ fontSize: '14px', whiteSpace: 'nowrap', fontWeight: '500' }}>
                  {med.quantidade || '_____________'}
                </span>
              </div>
              {/* Posologia */}
              {(med.via || med.frequencia || med.duracao) && (
                <p style={{ margin: '0 0 2px', paddingLeft: '18px', fontSize: '13.5px', color: '#333' }}>
                  <strong>Uso: </strong>
                  {[med.via, med.frequencia, med.duracao].filter(Boolean).join(' — ')}
                </p>
              )}
              {med.instrucoes && (
                <p style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
                  {med.instrucoes}
                </p>
              )}
            </div>
          ))}

          {/* Texto livre no impresso */}
          {textoLivre && (
            <div style={{ marginTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', paddingTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', borderTop: medicamentos.filter(m => m.nome).length > 0 ? '1px dashed #ccc' : 'none' }}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.8', margin: 0 }}>{textoLivre}</p>
            </div>
          )}

          <div style={{ marginTop: '60px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

function RelatorioPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const hojeISO = new Date().toISOString().split('T')[0];

  const [medico, setMedico] = React.useState('');
  const [crm, setCrm] = React.useState('');
  const [dataRelatorio, setDataRelatorio] = React.useState(hojeISO);
  const [finalidade, setFinalidade] = React.useState('');
  const [diagnostico, setDiagnostico] = React.useState('');
  const [historico, setHistorico] = React.useState('');
  const [exames, setExames] = React.useState('');
  const [conduta, setConduta] = React.useState('');
  const [conclusao, setConclusao] = React.useState('');
  const [salvo, setSalvo] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const dataFormatada = new Date(dataRelatorio + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      finalidade ? `Finalidade: ${finalidade}` : null,
      diagnostico ? `\nDIAGNÓSTICO:\n${diagnostico}` : null,
      historico ? `\nHISTÓRICO CLÍNICO E EVOLUÇÃO:\n${historico}` : null,
      exames ? `\nEXAMES COMPLEMENTARES:\n${exames}` : null,
      conduta ? `\nCONDUTA TERAPÊUTICA:\n${conduta}` : null,
      conclusao ? `\nCONCLUSÃO E PARECER:\n${conclusao}` : null,
    ].filter(Boolean).join('\n');

    const registro = {
      tipo: 'Relatório',
      titulo: `Relatório Médico${finalidade ? ' — ' + finalidade : ''}`,
      conteudo,
    };
    try {
      const salvoDb = await registrosService.criar(registro, paciente.id, user?.id);
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
      ));
    } catch (err) {
      console.error('Erro ao salvar relatório:', err);
      const agora = new Date();
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [{ id: Date.now(), ...registro, data: agora.toLocaleDateString('pt-BR'), hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...(p.registros || [])] } : p
      ));
    }
    setSalvo(true);
  };

  const campo = (label, value, setter, rows = 3, placeholder = '') => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => setter(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }}
      />
    </div>
  );

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '800px', margin: '20px auto' }}>

        {/* Formulário */}
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Preencher Relatório Médico</h3>

          <div className="form-grid-3col" style={{ marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome do Médico</label>
              <input value={medico} onChange={(e) => setMedico(e.target.value)} placeholder="Dr. Nome Sobrenome" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM</label>
              <input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="CRM 12345/SP" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
              <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Finalidade do Relatório</label>
            <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>
              <option value="">Selecione ou deixe em branco</option>
              <option value="Perícia médica">Perícia médica</option>
              <option value="Encaminhamento médico">Encaminhamento médico</option>
              <option value="Solicitação de benefício INSS">Solicitação de benefício INSS</option>
              <option value="Afastamento do trabalho">Afastamento do trabalho</option>
              <option value="Seguro de vida / plano de saúde">Seguro de vida / plano de saúde</option>
              <option value="Uso particular">Uso particular</option>
            </select>
          </div>

          {campo('Diagnóstico(s)', diagnostico, setDiagnostico, 2, 'Ex: Hipertensão arterial sistêmica (I10), Diabetes mellitus tipo 2 (E11)')}
          {campo('Histórico clínico e evolução', historico, setHistorico, 6, 'Descreva o quadro clínico, evolução da doença e tratamentos realizados...')}
          {campo('Exames complementares (opcional)', exames, setExames, 3, 'Resultados de exames laboratoriais, imagens, etc.')}
          {campo('Conduta terapêutica atual', conduta, setConduta, 2, 'Medicamentos em uso, terapias, restrições...')}
          {campo('Conclusão e parecer médico', conclusao, setConclusao, 3, 'Parecer final do médico sobre o caso...')}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={salvarNoProntuario} style={{ padding: '10px 18px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✓ Salvar no Prontuário
            </button>
            <button onClick={() => window.print()} style={{ padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        {/* Documento para impressão */}
        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <div style={{ textAlign: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <h2 style={{ margin: '0 0 2px', fontSize: '16px' }}>{medico || 'Dr. _______________________'}</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>{crm || 'CRM _______________'}</p>
          </div>

          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>RELATÓRIO MÉDICO</h2>
          {finalidade && <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 24px' }}>{finalidade}</p>}

          <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>Paciente:</strong> {paciente.nome}</p>
            {paciente.cpf && <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>CPF:</strong> {paciente.cpf}</p>}
            {paciente.nascimento && <p style={{ margin: '0', fontSize: '14px' }}><strong>Data de nascimento:</strong> {formatarData(paciente.nascimento)}</p>}
          </div>

          {diagnostico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Diagnóstico</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{diagnostico}</p>
            </div>
          )}

          {historico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Histórico Clínico e Evolução</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{historico}</p>
            </div>
          )}

          {exames && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Exames Complementares</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{exames}</p>
            </div>
          )}

          {conduta && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conduta Terapêutica Atual</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{conduta}</p>
            </div>
          )}

          {conclusao && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conclusão e Parecer Médico</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{conclusao}</p>
            </div>
          )}

          {!diagnostico && !historico && !conduta && !conclusao && (
            <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o relatório</p>
          )}

          <div style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

function ImprimirAtendimentoPage() {
  const { pacienteId, registroId } = useParams();
  const [paciente, setPaciente] = React.useState(null);
  const [registro, setRegistro] = React.useState(null);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      pacientesService.buscarPorId(pacienteId),
      registrosService.buscarPorId(registroId),
    ])
      .then(([p, r]) => { setPaciente(p); setRegistro(r); })
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [pacienteId, registroId]);

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  if (!paciente || !registro) return <div style={{ padding: '40px' }}>Registro não encontrado.</div>;

  const comorbidades = [
    { label: 'HAS',          valor: paciente.has },
    { label: 'DM',           valor: paciente.dm },
    { label: 'DAC',          valor: paciente.dac },
    { label: 'Dislipidemia', valor: paciente.dislipidemia },
    { label: 'Tabagismo',    valor: paciente.tabagismo },
    { label: 'Etilismo',     valor: paciente.etilismo },
  ].filter(c => c.valor && c.valor !== 'Não' && c.valor !== '');

  return (
    <div>
      {/* Barra de ações — oculta na impressão */}
      <div className="no-print" style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => window.print()} style={{ padding: '9px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          🖨️ Imprimir
        </button>
        <button onClick={() => window.close()} style={{ padding: '9px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
          Fechar
        </button>
        <span style={{ fontSize: '13px', color: '#555' }}>
          {paciente.nome} — {registro.data} às {registro.hora}
        </span>
      </div>

      {/* Documento */}
      <div className="doc-preview" style={{ maxWidth: '800px', margin: '20px auto', fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
        <CabecalhoImpresso paciente={paciente} />

        {/* Título e data */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>Registro de Atendimento</h2>
          <span style={{ fontSize: '13px', color: '#555' }}>{registro.data} às {registro.hora}</span>
        </div>

        {/* Antecedentes médicos */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
            Antecedentes Médicos
          </h3>
          {comorbidades.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {comorbidades.map(c => (
                <span key={c.label} style={{ padding: '3px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                  {c.label}{c.valor !== 'Sim' ? `: ${c.valor}` : ''}
                </span>
              ))}
            </div>
          )}
          {!comorbidades.length && <p style={{ color: '#999', margin: '0 0 8px' }}>Sem comorbidades registradas.</p>}
          {paciente.cirurgias && <p style={{ margin: '4px 0' }}><strong>Cirurgias prévias:</strong> {paciente.cirurgias}</p>}
          {paciente.medicamentosUso && <p style={{ margin: '4px 0' }}><strong>Medicamentos em uso:</strong> {paciente.medicamentosUso}</p>}
          {paciente.alergias && <p style={{ margin: '4px 0', color: '#dc2626', fontWeight: 'bold' }}>⚠ Alergias: {paciente.alergias}</p>}
        </div>

        {/* História clínica */}
        <div style={{ marginBottom: '50px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
            {registro.tipo === 'Consulta' ? 'História Clínica' : registro.titulo}
          </h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.9', textAlign: 'justify' }}>{registro.conteudo}</p>
        </div>

        {/* Assinatura */}
        <div style={{ marginTop: '50px', textAlign: 'right' }}>
          <p style={{ marginBottom: '50px', fontSize: '13px' }}>{registro.data}</p>
          <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>Assinatura e carimbo do médico</p>
            </div>
          </div>
        </div>
        <RodapeImpresso />
      </div>
    </div>
  );
}

const TIPOS_EXAME = [
  'Eletrocardiograma (ECG)',
  'Ecocardiograma transtorácico',
  'Ecocardiograma transesofágico',
  'Teste ergométrico',
  'Holter 24 horas',
  'MAPA 24 horas',
  'Cintilografia miocárdica',
  'Angiotomografia coronariana',
  'Ressonância magnética cardíaca',
  'Radiografia de tórax',
  'Ultrassom de abdome',
  'Doppler de carótidas',
  'Doppler venoso de MMII',
  'Espirometria',
  'Outro',
];

function LaudoPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const hojeISO = new Date().toISOString().split('T')[0];

  const [medico, setMedico]           = React.useState('');
  const [crm, setCrm]                 = React.useState('');
  const [dataExame, setDataExame]     = React.useState(hojeISO);
  const [tipoExame, setTipoExame]     = React.useState('');
  const [tipoOutro, setTipoOutro]     = React.useState('');
  const [achados, setAchados]         = React.useState('');
  const [conclusao, setConclusao]     = React.useState('');
  const [salvo, setSalvo]             = React.useState(false);
  const [salvando, setSalvando]       = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const nomeExame = tipoExame === 'Outro' ? tipoOutro : tipoExame;
  const dataFormatada = new Date(dataExame + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const salvarNoProntuario = async () => {
    if (!achados && !conclusao) return;
    setSalvando(true);
    const conteudo = [
      `Exame: ${nomeExame || 'Não informado'}`,
      achados   ? `\nACHADOS:\n${achados}`   : null,
      conclusao ? `\nCONCLUSÃO:\n${conclusao}` : null,
    ].filter(Boolean).join('\n');
    const registro = {
      tipo: 'Laudo',
      titulo: `Laudo — ${nomeExame || 'Exame'}`,
      conteudo,
    };
    try {
      const salvoDb = await registrosService.criar(registro, paciente.id, user?.id);
      setPacientes(pacientes.map(p =>
        p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
      ));
      setSalvo(true);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Laudo — {paciente.nome}</h3>

        <div className="form-grid-3col" style={{ marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Médico</label>
            <input value={medico} onChange={e => setMedico(e.target.value)} placeholder="Dr. Nome Sobrenome" style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM</label>
            <input value={crm} onChange={e => setCrm(e.target.value)} placeholder="CRM 12345/SP" style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data do exame</label>
            <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tipo de exame</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={tipoExame} onChange={e => setTipoExame(e.target.value)} style={{ padding: '8px', fontSize: '14px', flex: '1', minWidth: '200px' }}>
              <option value="">Selecione o exame...</option>
              {TIPOS_EXAME.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tipoExame === 'Outro' && (
              <input value={tipoOutro} onChange={e => setTipoOutro(e.target.value)} placeholder="Descreva o exame" style={{ padding: '8px', fontSize: '14px', flex: '2', minWidth: '200px' }} />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Achados / Descrição</label>
          <textarea value={achados} onChange={e => setAchados(e.target.value)} rows={7} placeholder="Descreva os achados do exame..." style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Conclusão / Impressão diagnóstica</label>
          <textarea value={conclusao} onChange={e => setConclusao(e.target.value)} rows={4} placeholder="Conclusão do laudo..." style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={salvando || (!achados && !conclusao)} style={{ padding: '10px 18px', backgroundColor: salvando || (!achados && !conclusao) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
          </button>
          <button onClick={() => window.print()} disabled={!achados && !conclusao} style={{ padding: '10px 18px', backgroundColor: !achados && !conclusao ? '#9ca3af' : '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
        </div>
      </div>

      {/* Documento para impressão */}
      <div className="doc-preview">
        <CabecalhoImpresso paciente={paciente} />

        <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
          <h2 style={{ margin: '0 0 2px', fontSize: '16px' }}>{medico || 'Dr. _______________________'}</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
        </div>

        <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>LAUDO</h2>
        {nomeExame && <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 20px' }}>{nomeExame}</p>}

        <div style={{ borderTop: '1px solid #ddd', paddingTop: '14px', marginBottom: '14px', fontSize: '13px' }}>
          <span><strong>Data do exame:</strong> {dataFormatada}</span>
        </div>

        {achados && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Achados</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{achados}</p>
          </div>
        )}

        {conclusao && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Conclusão</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{conclusao}</p>
          </div>
        )}

        {!achados && !conclusao && (
          <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o laudo</p>
        )}

        <div style={{ marginTop: '60px', textAlign: 'right' }}>
          <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
          <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
            </div>
          </div>
        </div>
        <RodapeImpresso />
      </div>
    </div>
  );
}

function PedidoExamesPage({ pacientes, setPacientes }) {
  const { id } = useParams();
  const { user } = useAuth();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const hojeISO = new Date().toISOString().split('T')[0];

  const [medico, setMedico]         = React.useState('');
  const [crm, setCrm]               = React.useState('');
  const [dataExame, setDataExame]   = React.useState(hojeISO);
  const [indicacao, setIndicacao]   = React.useState('');
  const [cid, setCid]               = React.useState('');
  const [numeroBenef, setNumeroBenef] = React.useState('');
  const [validadeCart, setValidadeCart] = React.useState('');
  const [examesSel, setExamesSel]   = React.useState(new Set());
  const [modo, setModo]             = React.useState('receituario');
  const [salvo, setSalvo]           = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const toggle = (exId) => setExamesSel(prev => {
    const n = new Set(prev);
    n.has(exId) ? n.delete(exId) : n.add(exId);
    return n;
  });

  const examsPorCategoria = EXAMES_DISPONIVEIS
    .map(cat => ({ ...cat, exames: cat.exames.filter(e => examesSel.has(e.id)) }))
    .filter(cat => cat.exames.length > 0);

  const todosExamesSel = EXAMES_DISPONIVEIS.flatMap(c => c.exames).filter(e => examesSel.has(e.id));

  const dataFormatada = new Date(dataExame + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const salvarNoProntuario = async () => {
    const conteudo = examsPorCategoria.map(cat =>
      `${cat.categoria}:\n` + cat.exames.map(e => `  • ${e.nome}`).join('\n')
    ).join('\n\n') + (indicacao ? `\n\nIndicação: ${indicacao}` : '') + (cid ? `  CID: ${cid}` : '');

    const registro = { tipo: 'Pedido de Exames', titulo: `Pedido de Exames — ${todosExamesSel.length} exame(s)`, conteudo };
    try {
      const salvoDb = await registrosService.criar(registro, paciente.id, user?.id);
      setPacientes(pacientes.map(p => p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p));
    } catch (err) {
      console.error('Erro ao salvar pedido:', err);
    }
    setSalvo(true);
  };

  const btnModo = (m, label) => (
    <button onClick={() => setModo(m)} style={{ padding: '7px 16px', backgroundColor: modo === m ? '#1d4ed8' : '#e5e7eb', color: modo === m ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === m ? 'bold' : 'normal', fontSize: '13px' }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Pedido de Exames — {paciente.nome}</h3>

        {/* Linha médico/CRM/data */}
        <div className="form-grid-3col" style={{ marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Médico</label>
            <input value={medico} onChange={e => setMedico(e.target.value)} placeholder="Dr. Nome Sobrenome" style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM</label>
            <input value={crm} onChange={e => setCrm(e.target.value)} placeholder="CRM 12345/SP" style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
            <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        {/* Dados TISS (só mostram quando modo TISS) */}
        {modo === 'tiss' && (
          <div className="form-grid-3col" style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
              <input value={paciente.convenio || ''} readOnly style={{ width: '100%', padding: '8px', backgroundColor: '#f8fafc' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nº Carteira do Beneficiário</label>
              <input value={numeroBenef} onChange={e => setNumeroBenef(e.target.value)} placeholder="000000000000000" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Validade da Carteira</label>
              <input type="date" value={validadeCart} onChange={e => setValidadeCart(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
        )}

        {/* Indicação e CID */}
        <div className="form-grid-3col" style={{ marginBottom: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Indicação clínica</label>
            <input value={indicacao} onChange={e => setIndicacao(e.target.value)} placeholder="Ex: Hipertensão arterial, investigação de dislipidemia..." style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID</label>
            <input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex: I10" style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        {/* Seleção de exames */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px' }}>Selecione os exames</strong>
            <span style={{ fontSize: '12px', backgroundColor: examesSel.size > 0 ? '#dbeafe' : '#f3f4f6', color: examesSel.size > 0 ? '#1d4ed8' : '#6b7280', padding: '3px 10px', borderRadius: '10px', fontWeight: 'bold' }}>
              {examesSel.size} selecionado(s)
            </span>
          </div>
          {EXAMES_DISPONIVEIS.map(cat => (
            <div key={cat.categoria} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px', marginBottom: '6px' }}>
                {cat.categoria}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {cat.exames.map(ex => {
                  const sel = examesSel.has(ex.id);
                  return (
                    <button key={ex.id} onClick={() => toggle(ex.id)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: sel ? '#dbeafe' : '#f9fafb', color: sel ? '#1d4ed8' : '#374151', border: `1px solid ${sel ? '#93c5fd' : '#e5e7eb'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: sel ? '700' : '400' }}>
                      {sel ? '✓ ' : ''}{ex.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={examesSel.size === 0} style={{ padding: '9px 16px', backgroundColor: examesSel.size === 0 ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: examesSel.size === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            ✓ Salvar no Prontuário
          </button>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Visualizar como:</span>
            {btnModo('receituario', '📋 Receituário')}
            {btnModo('tiss', '📄 Guia TISS')}
          </div>
          <button onClick={() => window.print()} disabled={examesSel.size === 0} style={{ padding: '9px 16px', backgroundColor: examesSel.size === 0 ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: examesSel.size === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '13px', fontWeight: 'bold' }}>✓ Salvo!</span>}
        </div>
      </div>

      {/* ===== PREVIEW RECEITUÁRIO ===== */}
      {modo === 'receituario' && (
        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
            <h2 style={{ margin: '0 0 2px', fontSize: '16px' }}>{medico || 'Dr. _______________________'}</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '17px', margin: '0 0 24px' }}>PEDIDO DE EXAMES</h2>

          {examsPorCategoria.length === 0
            ? <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>Nenhum exame selecionado</p>
            : examsPorCategoria.map(cat => (
              <div key={cat.categoria} style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', color: '#374151', borderBottom: '1px solid #eee', paddingBottom: '3px' }}>{cat.categoria}</p>
                {cat.exames.map(e => <p key={e.id} style={{ margin: '3px 0 3px 12px', fontSize: '14px' }}>• {e.nome}</p>)}
              </div>
            ))
          }

          {(indicacao || cid) && (
            <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '13px' }}>
              {indicacao && <p style={{ margin: '2px 0' }}><strong>Indicação:</strong> {indicacao}</p>}
              {cid && <p style={{ margin: '2px 0' }}><strong>CID:</strong> {cid}</p>}
            </div>
          )}

          <div style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      )}

      {/* ===== PREVIEW GUIA TISS ===== */}
      {modo === 'tiss' && (
        <div style={{ backgroundColor: 'white', padding: '24px 28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
          {/* Cabeçalho TISS */}
          <div style={{ border: '2px solid #222', marginBottom: '0' }}>
            <div style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogoClinica size={28} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{CLINICA.nome}</div>
                  <div style={{ fontSize: '10px', opacity: 0.85 }}>{CLINICA.subtitulo}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>GUIA DE SOLICITAÇÃO DE EXAME</div>
                <div style={{ fontSize: '10px' }}>Padrão TISS — ANS</div>
              </div>
            </div>

            {/* Linha 1: Nº guia / Operadora / Data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #aaa' }}>
              {[['Nº Guia do Prestador', ''], ['Nº Guia Operadora', ''], ['Data de Emissão', dataFormatada]].map(([l, v], i) => (
                <div key={i} style={{ padding: '4px 8px', borderRight: i < 2 ? '1px solid #aaa' : 'none' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                  <div style={{ fontWeight: 'bold', minHeight: '14px' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Dados do beneficiário */}
            <div style={{ borderBottom: '1px solid #aaa' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>DADOS DO BENEFICIÁRIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '4px 0' }}>
                {[['Nome do Beneficiário', paciente.nome], ['Nº Carteira', numeroBenef || '_______________'], ['Validade', validadeCart ? new Date(validadeCart + 'T12:00:00').toLocaleDateString('pt-BR') : '__/__/____']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i < 2 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0', borderTop: '1px solid #ddd' }}>
                {[['Plano / Produto', paciente.convenio || '_______________'], ['CPF', paciente.cpf || '___.___.___-__']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i === 0 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dados do prestador */}
            <div style={{ borderBottom: '1px solid #aaa' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>DADOS DO PRESTADOR SOLICITANTE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '4px 0' }}>
                {[['Nome do Prestador', CLINICA.nome], ['Código CNES', '0000000'], ['CRM Médico', crm || '___________']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i < 2 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderTop: '1px solid #ddd' }}>
                <div style={{ padding: '3px 8px', borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>Nome do Médico Solicitante</div>
                  <div style={{ fontWeight: 'bold' }}>{medico || '_______________________________'}</div>
                </div>
                <div style={{ padding: '3px 8px' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>CID Principal</div>
                  <div style={{ fontWeight: 'bold' }}>{cid || '______'}</div>
                </div>
              </div>
            </div>

            {/* Indicação */}
            {indicacao && (
              <div style={{ borderBottom: '1px solid #aaa', padding: '4px 8px' }}>
                <span style={{ fontSize: '9px', color: '#555' }}>Indicação clínica: </span>
                <span style={{ fontWeight: 'bold' }}>{indicacao}</span>
              </div>
            )}

            {/* Tabela de exames */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  {['Cód. TUSS', 'Descrição do Procedimento', 'Qtd.', 'Tp. Atend.', 'Autorizado', 'Qtd. Aut.'].map((h, i) => (
                    <th key={i} style={{ padding: '4px 6px', textAlign: 'left', fontSize: '9px', borderBottom: '1px solid #aaa', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todosExamesSel.length === 0
                  ? <tr><td colSpan={6} style={{ padding: '8px', textAlign: 'center', color: '#aaa', fontStyle: 'italic' }}>Nenhum exame selecionado</td></tr>
                  : todosExamesSel.map((ex, i) => (
                    <tr key={ex.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>{ex.tuss}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd' }}>{ex.nome}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', textAlign: 'center' }}>AMB</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', minWidth: '60px' }}>&nbsp;</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', minWidth: '50px' }}>&nbsp;</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>

            {/* Assinaturas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #aaa' }}>
              <div style={{ padding: '8px', borderRight: '1px solid #aaa', minHeight: '55px' }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Assinatura e carimbo do médico solicitante</div>
                <div style={{ borderTop: '1px solid #333', marginTop: '30px', paddingTop: '4px', fontSize: '9px', textAlign: 'center' }}>
                  {medico || '_______________________________'}{crm ? ` — ${crm}` : ''}
                </div>
              </div>
              <div style={{ padding: '8px', minHeight: '55px' }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Assinatura do beneficiário / responsável</div>
                <div style={{ borderTop: '1px solid #333', marginTop: '30px', paddingTop: '4px', fontSize: '9px', textAlign: 'center' }}>
                  {paciente.nome}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '9px', color: '#888', textAlign: 'center' }}>
            {CLINICA.endereco} — {CLINICA.cidade} — {CLINICA.telefone}
          </div>
        </div>
      )}
    </div>
  );
}

function UsuariosPage() {
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [form, setForm] = React.useState({ nome: '', email: '', senha: '', confirmar: '', funcao: 'Médico', crm: '' });
  const [mostraSenha, setMostraSenha] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  React.useEffect(() => {
    usuariosService.listar()
      .then(setUsuarios)
      .catch(err => console.error(err))
      .finally(() => setCarregando(false));
  }, []);

  const criarUsuario = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.senha !== form.confirmar) {
      setMsg({ tipo: 'erro', texto: 'As senhas não conferem.' });
      return;
    }
    if (form.senha.length < 6) {
      setMsg({ tipo: 'erro', texto: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    setSalvando(true);
    try {
      await usuariosService.criar({ nome: form.nome, email: form.email, senha: form.senha, funcao: form.funcao, crm: form.crm });
      const lista = await usuariosService.listar();
      setUsuarios(lista);
      setForm({ nome: '', email: '', senha: '', confirmar: '', funcao: 'Médico', crm: '' });
      setMsg({ tipo: 'sucesso', texto: `Usuário "${form.nome}" criado com sucesso. Um e-mail de confirmação será enviado para ${form.email}.` });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (id, ativoAtual) => {
    try {
      await usuariosService.alterarStatus(id, !ativoAtual);
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ativo: !ativoAtual } : u));
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const funcaoIcone = { 'Médico': '👨‍⚕️', 'Enfermeiro(a)': '👩‍⚕️', 'Recepcionista': '💼', 'Administrador': '⚙️' };

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar</Link>

      <h2 style={{ marginTop: '20px' }}>Gerenciar Usuários do Sistema</h2>

      {/* Formulário novo usuário */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Novo Usuário</h3>
        <form onSubmit={criarUsuario}>
          <div className="form-grid-3col" style={{ marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome completo *</label>
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Dr. João Silva" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>E-mail *</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@clinica.com" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Função</label>
              <select value={form.funcao} onChange={e => setForm({ ...form, funcao: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>
                <option>Médico</option>
                <option>Enfermeiro(a)</option>
                <option>Recepcionista</option>
                <option>Administrador</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(médicos)</span></label>
              <input value={form.crm} onChange={e => setForm({ ...form, crm: e.target.value })} placeholder="CRM 12345/SP" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Senha temporária *</label>
              <input required type={mostraSenha ? 'text' : 'password'} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="mín. 6 caracteres" style={{ width: '100%', padding: '8px', paddingRight: '72px' }} />
              <button type="button" onClick={() => setMostraSenha(!mostraSenha)} style={{ position: 'absolute', right: '4px', top: '29px', padding: '4px 8px', fontSize: '11px', background: '#f3f4f6', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}>
                {mostraSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Confirmar senha *</label>
              <input required type={mostraSenha ? 'text' : 'password'} value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} placeholder="repita a senha" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', backgroundColor: msg.tipo === 'sucesso' ? '#d1fae5' : '#fee2e2', color: msg.tipo === 'sucesso' ? '#065f46' : '#991b1b', fontSize: '14px' }}>
              {msg.tipo === 'sucesso' ? '✓ ' : '⚠ '}{msg.texto}
            </div>
          )}

          <button type="submit" disabled={salvando} style={{ padding: '10px 20px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Criando...' : '+ Criar Usuário'}
          </button>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6b7280' }}>
            * Informe a senha temporária ao novo usuário. Ele precisará confirmar o e-mail antes de fazer o primeiro login.
          </p>
        </form>
      </div>

      {/* Lista de usuários */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Usuários Cadastrados ({usuarios.length})</h3>
        {carregando ? (
          <p style={{ color: '#666' }}>Carregando...</p>
        ) : usuarios.length === 0 ? (
          <p style={{ color: '#999' }}>Nenhum usuário encontrado. Faça logout e login novamente para que seu perfil apareça aqui.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {usuarios.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: u.ativo ? '#fff' : '#f9fafb', opacity: u.ativo ? 1 : 0.65, flexWrap: 'wrap' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '50%', backgroundColor: u.ativo ? '#dbeafe' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  {funcaoIcone[u.funcao] || '👤'}
                </div>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: '#111' }}>{u.nome}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{u.email}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    {u.funcao}{u.crm ? ` · ${u.crm}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '10px', backgroundColor: u.ativo ? '#d1fae5' : '#fee2e2', color: u.ativo ? '#065f46' : '#991b1b', fontWeight: '500' }}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <button onClick={() => alterarStatus(u.id, u.ativo)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: u.ativo ? '#fee2e2' : '#d1fae5', color: u.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>
                    {u.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentoPage({ titulo, pacientes }) {
  const { id } = useParams();
  const paciente = pacientes.find((p) => String(p.id) === String(id));

  if (!paciente) {
    return <p>Paciente não encontrado.</p>;
  }

  return (
    <div>
      <Header />

      <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>

      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>{titulo}</h2>
        <p><strong>Paciente:</strong> {paciente.nome}</p>
        <p><strong>CPF:</strong> {paciente.cpf}</p>

        <textarea
          placeholder={`Digite aqui o conteúdo de ${titulo.toLowerCase()}...`}
          rows={12}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '15px',
            fontSize: '16px'
          }}
        />

        <button style={{
          marginTop: '12px',
          padding: '12px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Salvar {titulo}
        </button>
      </div>
    </div>
  );
}

const painelStyle = {
  backgroundColor: 'white',
  padding: '18px',
  borderRadius: '10px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};
const atalhoStyle = {
  display: 'block',
  textAlign: 'center',
  padding: '16px',
  backgroundColor: '#007bff',
  color: 'white',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: 'bold'
};

function AppContent() {
  const { user } = useAuth();
  const [pacientes, setPacientes] = React.useState([]);
  const [inicializando, setInicializando] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    pacientesService.listar()
      .then(data => setPacientes(data))
      .catch(err => console.error('Erro ao carregar pacientes:', err))
      .finally(() => setInicializando(false));
  }, [user?.id]);

  if (inicializando && user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666', fontSize: '16px' }}>Carregando pacientes...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/pacientes" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/pacientes" replace />} />
      <Route
        path="/laudos/:id"
        element={
          <ProtectedLayout>
            <LaudoPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/pedido-exames/:id"
        element={
          <ProtectedLayout>
            <PedidoExamesPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/imprimir/:pacienteId/:registroId"
        element={
          <ProtectedLayout>
            <ImprimirAtendimentoPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedLayout>
            <UsuariosPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/pacientes"
        element={
          <ProtectedLayout>
            <PacientesPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/prontuario/:id"
        element={
          <ProtectedLayout>
            <ProntuarioPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/receituario/:id"
        element={
          <ProtectedLayout>
            <ReceituarioPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/prescricao/:id"
        element={
          <ProtectedLayout>
            <DocumentoPage titulo="Prescrição Médica" pacientes={pacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/atestados/:id"
        element={
          <ProtectedLayout>
            <AtestadoPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/relatorios/:id"
        element={
          <ProtectedLayout>
            <RelatorioPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
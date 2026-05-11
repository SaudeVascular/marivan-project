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

function Header() {
  const { logout, user } = useAuth();
  return (
    <div style={{
      backgroundColor: '#007bff',
      color: 'white',
      padding: '15px 20px',
      marginBottom: '25px',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '20px' }}>PEP - Prontuário Eletrônico</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.85 }}>Sistema médico</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', opacity: 0.85 }}>{user?.email}</span>
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f2fe 0%, #f8fafc 50%, #dbeafe 100%)',
      padding: '25px'
    }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '10px' }}>
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1.4fr',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
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

                <div
                  style={{
                    marginTop: '8px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 2fr 1fr',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#444'
                  }}
                >
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
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  const [atendimentoAtual, setAtendimentoAtual] = React.useState('');
  const [registroAberto, setRegistroAberto] = React.useState(null);
  const [editandoClinicos, setEditandoClinicos] = React.useState(false);
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

  const salvarClinicos = async () => {
    try {
      await pacientesService.atualizar(paciente.id, { ...paciente, ...clinicos });
    } catch (err) {
      console.error('Erro ao salvar dados clínicos:', err);
    }
    setPacientes(pacientes.map((p) => p.id === paciente.id ? { ...p, ...clinicos } : p));
    setEditandoClinicos(false);
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
  };

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar para pacientes</Link>
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '250px 1.4fr 1fr', gap: '18px', alignItems: 'start' }}>

        {/* Painel esquerdo — dados do paciente */}
        <div style={painelStyle}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#dbeafe', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>👤</div>
          <h2 style={{ marginBottom: '4px', fontSize: '15px', textAlign: 'center' }}>{paciente.nome}</h2>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '10px' }}>
            <p style={{ margin: '2px 0' }}><strong>CPF:</strong> {paciente.cpf || '-'}</p>
            <p style={{ margin: '2px 0' }}><strong>Nasc.:</strong> {formatarData(paciente.nascimento)}</p>
            <p style={{ margin: '2px 0' }}><strong>Tel.:</strong> {paciente.telefone || '-'}</p>
            <p style={{ margin: '2px 0' }}><strong>Convênio:</strong> {paciente.convenio || '-'}</p>
          </div>
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
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
          {campoSelect('HAS', 'has')}
          {campoSelect('DM', 'dm')}
          {campoSelect('DAC', 'dac')}
          {campoSelect('Dislipidemia', 'dislipidemia')}
          {campoSelect('Tabagismo', 'tabagismo', ['Ex-tabagista'])}
          {campoSelect('Etilismo', 'etilismo', ['Ocasional'])}
          <div style={{ marginBottom: '6px' }}>
            <strong style={{ fontSize: '12px' }}>Cirurgias: </strong>
            {editandoClinicos ? (
              <textarea value={clinicos.cirurgias} onChange={(e) => setClinicos({ ...clinicos, cirurgias: e.target.value })} placeholder="Ex: Apendicectomia 2010" style={{ width: '100%', fontSize: '12px', padding: '4px', marginTop: '2px' }} rows={2} />
            ) : (
              <span style={{ fontSize: '12px', color: clinicos.cirurgias ? '#333' : '#999' }}>{clinicos.cirurgias || 'Não informado'}</span>
            )}
          </div>
          <hr />
          <strong style={{ fontSize: '12px' }}>Medicamentos em uso</strong>
          {editandoClinicos ? (
            <textarea value={clinicos.medicamentosUso} onChange={(e) => setClinicos({ ...clinicos, medicamentosUso: e.target.value })} style={{ width: '100%', fontSize: '12px', padding: '4px', marginTop: '4px' }} rows={3} />
          ) : (
            <p style={{ fontSize: '12px', color: clinicos.medicamentosUso ? '#333' : '#999', marginTop: '4px' }}>{clinicos.medicamentosUso || 'Não informado'}</p>
          )}
          <strong style={{ fontSize: '12px' }}>Alergias</strong>
          {editandoClinicos ? (
            <input value={clinicos.alergias} onChange={(e) => setClinicos({ ...clinicos, alergias: e.target.value })} style={{ width: '100%', fontSize: '12px', padding: '4px', marginTop: '4px' }} />
          ) : (
            <p style={{ fontSize: '12px', color: clinicos.alergias ? '#dc3545' : '#999', fontWeight: clinicos.alergias ? 'bold' : 'normal', marginTop: '4px' }}>{clinicos.alergias || 'Não informado'}</p>
          )}
        </div>

        {/* Painel central — atendimento atual */}
        <div style={painelStyle}>
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
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <Link to={`/receituario/${paciente.id}`} style={atalhoStyle}>📋 Receituário</Link>
            <Link to={`/atestados/${paciente.id}`} style={atalhoStyle}>📄 Atestado</Link>
            <Link to={`/prescricao/${paciente.id}`} style={atalhoStyle}>💊 Prescrição</Link>
            <Link to={`/relatorios/${paciente.id}`} style={atalhoStyle}>📊 Relatório</Link>
          </div>
        </div>

        {/* Painel direito — histórico */}
        <div style={painelStyle}>
          <h2 style={{ marginTop: 0 }}>Histórico ({registros.length})</h2>
          {registros.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px' }}>Nenhum registro ainda.</p>
          ) : (
            registros.map((registro) => {
              const cor = coresTipo[registro.tipo] || '#007bff';
              const aberto = registroAberto === registro.id;
              return (
                <div key={registro.id} style={{ marginBottom: '8px' }}>
                  <div
                    onClick={() => setRegistroAberto(aberto ? null : registro.id)}
                    style={{ borderLeft: `4px solid ${cor}`, backgroundColor: aberto ? '#f0f7ff' : '#f8f9fa', padding: '8px 10px', borderRadius: aberto ? '6px 6px 0 0' : '6px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', backgroundColor: cor, color: 'white', padding: '1px 7px', borderRadius: '10px' }}>{registro.tipo}</span>
                      <span style={{ fontSize: '11px', color: '#666' }}>{registro.data} {registro.hora}</span>
                    </div>
                    <p style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: '500' }}>{registro.titulo}</p>
                    <small style={{ color: cor, fontSize: '11px' }}>{aberto ? '▲ Fechar' : '▼ Ver detalhes'}</small>
                  </div>
                  {aberto && (
                    <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderTop: 'none', padding: '10px 12px', borderRadius: '0 0 6px 6px', whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6', maxHeight: '280px', overflowY: 'auto' }}>
                      {registro.conteudo}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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

        <div style={{ backgroundColor: 'white', padding: '50px 60px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', paddingBottom: '16px', borderBottom: '2px solid #222' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{medico || 'Dr. _______________________'}</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{crm || 'CRM _______________'}</p>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 40px' }}>ATESTADO MÉDICO</h2>
          <p style={{ fontSize: '15px', lineHeight: '2.2', textAlign: 'justify' }}>
            Atesto que o(a) paciente <strong>{paciente.nome}</strong>
            {paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ','} esteve sob meus cuidados médicos
            e necessita afastar-se de suas atividades por{' '}
            <strong>{dias} {Number(dias) === 1 ? 'dia' : 'dias'}</strong>, a contar de {dataFormatada}.
            {cid && ` CID: ${cid}.`}
          </p>
          {observacoes && <p style={{ fontSize: '15px', lineHeight: '2', textAlign: 'justify' }}>{observacoes}</p>}
          <div style={{ marginTop: '80px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
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

  const [medico, setMedico] = React.useState('');
  const [crm, setCrm] = React.useState('');
  const [dataReceita, setDataReceita] = React.useState(hojeISO);
  const [salvo, setSalvo] = React.useState(false);
  const [medicamentos, setMedicamentos] = React.useState([
    { id: 1, nome: '', dose: '', frequencia: '', duracao: '', instrucoes: '' }
  ]);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const adicionarMed = () => setMedicamentos([...medicamentos, {
    id: Date.now(), nome: '', dose: '', frequencia: '', duracao: '', instrucoes: ''
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

    const conteudo = `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}\n\n${medsTexto}`;
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
          <h3 style={{ marginTop: 0 }}>Preencher Receituário</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
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
              <input type="date" value={dataReceita} onChange={(e) => setDataReceita(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
          <h4 style={{ margin: '0 0 10px' }}>Medicamentos</h4>
          {medicamentos.map((med, idx) => (
            <div key={med.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#374151' }}>Medicamento {idx + 1}</strong>
                {medicamentos.length > 1 && (
                  <button onClick={() => removerMed(med.id)} style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Remover</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="Nome do medicamento *" value={med.nome} onChange={(e) => atualizarMed(med.id, 'nome', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Dose (50mg)" value={med.dose} onChange={(e) => atualizarMed(med.id, 'dose', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Frequência (1x/dia)" value={med.frequencia} onChange={(e) => atualizarMed(med.id, 'frequencia', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Duração (30 dias)" value={med.duracao} onChange={(e) => atualizarMed(med.id, 'duracao', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
              </div>
              <input placeholder="Instruções (ex: tomar após as refeições)" value={med.instrucoes} onChange={(e) => atualizarMed(med.id, 'instrucoes', e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarMed} style={{ padding: '9px 16px', backgroundColor: '#e8f5e9', color: '#28a745', border: '1px solid #c8e6c9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Medicamento</button>
            <button onClick={salvarNoProntuario} style={{ padding: '9px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✓ Salvar no Prontuário</button>
            <button onClick={() => window.print()} style={{ padding: '9px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir</button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '50px 60px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #222' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{medico || 'Dr. _______________________'}</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{crm || 'CRM _______________'}</p>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 20px' }}>RECEITUÁRIO</h2>
          <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>Paciente:</strong> {paciente.nome}</p>
          {paciente.cpf && <p style={{ margin: '0 0 16px', fontSize: '14px' }}><strong>CPF:</strong> {paciente.cpf}</p>}
          <hr style={{ margin: '16px 0' }} />
          {medicamentos.filter(m => m.nome).map((med, idx) => (
            <div key={med.id} style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '15px' }}>
                {idx + 1}. {med.nome}{med.dose ? ` ${med.dose}` : ''}
              </p>
              {(med.frequencia || med.duracao) && (
                <p style={{ margin: '0 0 2px', paddingLeft: '20px', fontSize: '14px' }}>
                  Tomar {med.frequencia}{med.duracao ? ` por ${med.duracao}` : ''}
                </p>
              )}
              {med.instrucoes && (
                <p style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#555', fontStyle: 'italic' }}>{med.instrucoes}</p>
              )}
            </div>
          ))}
          {medicamentos.filter(m => m.nome).length === 0 && (
            <p style={{ color: '#999', textAlign: 'center', fontStyle: 'italic' }}>Preencha os medicamentos acima</p>
          )}
          <div style={{ marginTop: '70px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              </div>
            </div>
          </div>
        </div>
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
            <DocumentoPage titulo="Relatório Médico" pacientes={pacientes} />
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
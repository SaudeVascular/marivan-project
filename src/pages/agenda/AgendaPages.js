import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { agendamentosService } from '../../services/agendamentos.service';
import { usuariosService } from '../../services/usuarios.service';
import { comTimeout } from '../../utils/comTimeout';
import { FUNCOES_CLINICAS } from '../../constants/roles';

export const STATUS_CORES = {
  'Agendado': '#3b82f6',
  'Confirmado': '#0891b2',
  'Aguardando': '#f59e0b',
  'Em atendimento': '#8b5cf6',
  'Realizado': '#28a745',
  'Cancelado': '#ef4444',
  'Faltou': '#6c757d',
};

export const PROXIMOS_STATUS = {
  'Agendado': ['Confirmado', 'Aguardando', 'Cancelado'],
  'Confirmado': ['Aguardando', 'Cancelado', 'Faltou'],
  'Aguardando': ['Em atendimento', 'Cancelado', 'Faltou'],
  'Em atendimento': ['Realizado', 'Cancelado'],
  'Realizado': [],
  'Cancelado': [],
  'Faltou': [],
};

export function NovoAgendamentoForm({ pacientes, profissionais, dataPadrao, userId, onCriado, onCancelar }) {
  const [busca, setBusca] = React.useState('');
  const [pacienteId, setPacienteId] = React.useState('');
  const [medicoId, setMedicoId] = React.useState('');
  const [data, setData] = React.useState(dataPadrao);
  const [hora, setHora] = React.useState('');
  const [duracaoMin, setDuracaoMin] = React.useState(30);
  const [observacoes, setObservacoes] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const pacientesFiltrados = busca.trim()
    ? pacientes.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.cpf || '').includes(busca)
      ).slice(0, 8)
    : [];

  const pacienteSelecionado = pacientes.find(p => p.id === pacienteId);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!pacienteId) { setErro('Selecione um paciente.'); return; }
    if (!data || !hora) { setErro('Preencha data e horário.'); return; }
    setSalvando(true);
    try {
      const novo = await comTimeout(agendamentosService.criar(
        { pacienteId, medicoId: medicoId || null, data, hora, duracaoMin: Number(duracaoMin), observacoes },
        userId
      ));
      onCriado(novo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0 }}>Novo agendamento</h3>
      <form onSubmit={salvar}>
        {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Paciente *</label>
          {pacienteSelecionado ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{pacienteSelecionado.nome}{pacienteSelecionado.cpf ? ` — ${pacienteSelecionado.cpf}` : ''}</span>
              <button type="button" onClick={() => { setPacienteId(''); setBusca(''); }} style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}>trocar</button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar paciente já cadastrado, por nome ou CPF..."
                style={{ width: '100%', padding: '8px' }}
              />
              {pacientesFiltrados.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', marginTop: '4px', maxHeight: '160px', overflow: 'auto' }}>
                  {pacientesFiltrados.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { setPacienteId(p.id); setBusca(''); }}
                      style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '14px' }}
                    >
                      {p.nome} {p.cpf ? `— ${p.cpf}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data *</label>
            <input type="date" required value={data} onChange={e => setData(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Horário *</label>
            <input type="time" required value={hora} onChange={e => setHora(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Duração</label>
            <select value={duracaoMin} onChange={e => setDuracaoMin(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Profissional</label>
          <select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="">Não definido</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.nome} ({p.funcao})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observações</label>
          <input value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ width: '100%', padding: '8px' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={salvando} style={{ padding: '10px 20px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvando...' : '✓ Agendar'}
          </button>
          <button type="button" onClick={onCancelar} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export function AgendaPage({ pacientes }) {
  const toast = useToast();
  const { user, funcao } = useAuth();
  const podeAtender = FUNCOES_CLINICAS.includes(funcao);

  const hojeISO = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = React.useState(hojeISO);
  const [agendamentos, setAgendamentos] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    agendamentosService.listarPorData(dataSelecionada)
      .then(setAgendamentos)
      .catch(err => setErro(err.message || 'Erro ao carregar agenda.'))
      .finally(() => setCarregando(false));
  }, [dataSelecionada]);

  React.useEffect(() => { carregar(); }, [carregar]);

  React.useEffect(() => {
    usuariosService.listar().then(setUsuarios).catch(() => {});
  }, []);

  const profissionais = usuarios.filter(u => u.ativo && ['Médico', 'Enfermeiro(a)'].includes(u.funcao));

  const nomePaciente = (id) => pacientes.find(p => p.id === id)?.nome || '(paciente não encontrado)';
  const nomeProfissional = (id) => usuarios.find(u => u.id === id)?.nome || '—';

  const mudarStatus = async (ag, novoStatus) => {
    setProcessandoId(ag.id);
    try {
      const atualizado = await comTimeout(agendamentosService.atualizarStatus(ag.id, novoStatus));
      setAgendamentos(prev => prev.map(a => a.id === ag.id ? atualizado : a));
    } catch (err) {
      toast.error('Erro ao atualizar status: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const mudarDia = (delta) => {
    const d = new Date(dataSelecionada + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDataSelecionada(d.toISOString().split('T')[0]);
  };

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar</Link>

      <h2 style={{ marginTop: '20px' }}>Agenda</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => mudarDia(-1)} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Dia anterior</button>
        <input type="date" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} style={{ padding: '8px' }} />
        <button onClick={() => mudarDia(1)} style={{ padding: '8px 12px', cursor: 'pointer' }}>Dia seguinte →</button>
        <button onClick={() => setDataSelecionada(hojeISO)} style={{ padding: '8px 12px', cursor: 'pointer' }}>Hoje</button>
        {!mostrarForm && (
          <button onClick={() => setMostrarForm(true)} style={{ marginLeft: 'auto', padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Novo agendamento
          </button>
        )}
      </div>

      {mostrarForm && (
        <NovoAgendamentoForm
          pacientes={pacientes}
          profissionais={profissionais}
          dataPadrao={dataSelecionada}
          userId={user?.id}
          onCancelar={() => setMostrarForm(false)}
          onCriado={(novo) => {
            setMostrarForm(false);
            if (novo.data === dataSelecionada) {
              setAgendamentos(prev => [...prev, novo].sort((a, b) => a.hora.localeCompare(b.hora)));
            }
          }}
        />
      )}

      {erro && <p style={{ color: '#dc2626' }}>{erro}</p>}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {carregando ? (
          <p style={{ padding: '20px', color: '#666' }}>Carregando...</p>
        ) : agendamentos.length === 0 ? (
          <p style={{ padding: '20px', color: '#666' }}>Nenhum agendamento para este dia.</p>
        ) : (
          agendamentos.map(ag => (
            <div key={ag.id} style={{ borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong>{ag.hora}</strong> — {nomePaciente(ag.pacienteId)}
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {nomeProfissional(ag.medicoId)} · {ag.duracaoMin} min
                  {ag.observacoes && <> · {ag.observacoes}</>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: STATUS_CORES[ag.status] || '#6b7280', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  {ag.status}
                </span>
                {(PROXIMOS_STATUS[ag.status] || []).map(s => (
                  <button
                    key={s}
                    onClick={() => mudarStatus(ag, s)}
                    disabled={processandoId === ag.id}
                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === ag.id ? 'not-allowed' : 'pointer', opacity: processandoId === ag.id ? 0.5 : 1 }}
                  >
                    {s}
                  </button>
                ))}
                {podeAtender && ['Agendado', 'Confirmado', 'Aguardando', 'Em atendimento'].includes(ag.status) && (
                  <Link
                    to={`/prontuario/${ag.pacienteId}`}
                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', textDecoration: 'none' }}
                  >
                    Atender
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

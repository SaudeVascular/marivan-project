import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { agendamentosService } from '../../services/agendamentos.service';
import { usuariosService } from '../../services/usuarios.service';
import { comTimeout } from '../../utils/comTimeout';
import { STATUS_CORES, PROXIMOS_STATUS, NovoAgendamentoForm } from '../agenda/AgendaPages';

// Mesma agenda que AgendaPage, mas recortada para o fluxo de check-in da
// recepção: telefone/convênio à mão para ligar, sem o botão "Atender"
// (que não é tarefa dela) e sem exigir passar pela Agenda genérica.
export function RecepcaoPage({ pacientes }) {
  const toast = useToast();
  const { user } = useAuth();

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

  const pacientePor = (id) => pacientes.find(p => p.id === id);
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

      <h2 style={{ marginTop: '20px' }}>Recepção — Check-in do dia</h2>

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
          agendamentos.map(ag => {
            const paciente = pacientePor(ag.pacienteId);
            return (
              <div key={ag.id} style={{ borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong>{ag.hora}</strong> — {paciente?.nome || '(paciente não encontrado)'}
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {nomeProfissional(ag.medicoId)} · {ag.duracaoMin} min
                    {ag.observacoes && <> · {ag.observacoes}</>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                    {paciente?.telefone
                      ? <a href={`tel:${paciente.telefone.replace(/\D/g, '')}`} style={{ color: '#0369a1', textDecoration: 'none' }}>📞 {paciente.telefone}</a>
                      : <span>📞 sem telefone cadastrado</span>}
                    {paciente?.convenio && <> · {paciente.convenio}</>}
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

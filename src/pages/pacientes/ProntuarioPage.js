import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Header, painelStyle, atalhoStyle } from '../../components/common/Layout';
import { registrosService } from '../../services/registros.service';
import { pacientesService } from '../../services/pacientes.service';
import { comTimeout } from '../../utils/comTimeout';
import { formatarData } from '../../utils/mascaras';
import { calcularIdade } from '../../utils/formatters';
import { RASCUNHO_ATENDIMENTO_PREFIX } from '../../utils/rascunhoAtendimento';

export function ProntuarioPage({ pacientes, setPacientes }) {
  const { user, funcao } = useAuth();
  const enfermeiro = funcao === 'Enfermeiro(a)';
  const { paciente } = usePacienteAtual(pacientes);
  const [atendimentoAtual, setAtendimentoAtual] = React.useState('');
  const [registroAberto, setRegistroAberto] = React.useState(null);
  const [registroEditando, setRegistroEditando] = React.useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [editandoClinicos, setEditandoClinicos] = React.useState(false);
  const [salvandoAtendimento, setSalvandoAtendimento] = React.useState(false);
  const [erroAtendimento, setErroAtendimento] = React.useState('');
  const [salvandoClinicos, setSalvandoClinicos] = React.useState(false);
  const [splitPct, setSplitPct] = React.useState(55);
  const isDragging = React.useRef(false);
  const splitContainerRef = React.useRef(null);
  const [rascunhoRestaurado, setRascunhoRestaurado] = React.useState(false);

  React.useEffect(() => {
    if (!paciente?.id) return;
    const salvo = localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + paciente.id);
    if (salvo) {
      setAtendimentoAtual(salvo);
      setRascunhoRestaurado(true);
    }
  }, [paciente?.id]);

  const salvarRascunho = React.useCallback((texto) => {
    if (!paciente?.id) return false;
    if (texto && texto.trim()) {
      localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + paciente.id, texto);
      return true;
    }
    localStorage.removeItem(RASCUNHO_ATENDIMENTO_PREFIX + paciente.id);
    return false;
  }, [paciente?.id]);

  const { isSaving: salvandoRascunho, lastSaved: rascunhoSalvoEm } = useAutoSave(atendimentoAtual, salvarRascunho, 1500);

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

  // Só deve reinicializar quando o paciente EXIBIDO muda (paciente.id), não
  // a cada nova referência do objeto `paciente` — isso aconteceria a cada
  // atualização de `pacientes` em qualquer lugar do app (ex.: outro
  // registro sendo salvo) e sobrescreveria uma edição de "Dados Clínicos"
  // em andamento. Por isso o efeito lê `paciente` por uma ref sempre
  // atualizada, em vez de declarar `paciente` como dependência.
  const pacienteRef = React.useRef(paciente);
  React.useEffect(() => { pacienteRef.current = paciente; });

  React.useEffect(() => {
    const p = pacienteRef.current;
    if (p) {
      setClinicos({
        has: p.has || '',
        dm: p.dm || '',
        dac: p.dac || '',
        dislipidemia: p.dislipidemia || '',
        tabagismo: p.tabagismo || '',
        etilismo: p.etilismo || '',
        cirurgias: p.cirurgias || '',
        medicamentosUso: p.medicamentosUso || '',
        alergias: p.alergias || '',
      });
      // Carrega histórico do banco se ainda não carregou
      if (!p.registros?.length) {
        registrosService.listarPorPaciente(p.id)
          .then(registros => setPacientes(prev =>
            prev.map(pp => pp.id === p.id ? { ...pp, registros } : pp)
          ))
          .catch(err => console.error('Erro ao carregar histórico:', err));
      }
    }
  }, [paciente?.id, setPacientes]);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const registros = paciente.registros || [];

  const salvarAtendimento = async () => {
    if (!atendimentoAtual.trim()) return;
    setSalvandoAtendimento(true);
    setErroAtendimento('');
    const agora = new Date();
    const registroLocal = {
      tipo: enfermeiro ? 'Evolução de Enfermagem' : 'Consulta',
      titulo: enfermeiro ? 'Evolução de enfermagem' : 'Atendimento médico',
      conteudo: atendimentoAtual,
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    try {
      const salvo = await comTimeout(registrosService.criar(registroLocal, paciente.id, user?.id));
      setPacientes(pacientes.map((p) =>
        p.id === paciente.id ? { ...p, registros: [salvo, ...(p.registros || [])] } : p
      ));
      // Só limpa o rascunho e o texto quando o servidor confirma de verdade
      // — nunca antes, senão um erro de rede apaga o atendimento sem salvar.
      localStorage.removeItem(RASCUNHO_ATENDIMENTO_PREFIX + paciente.id);
      setRascunhoRestaurado(false);
      setAtendimentoAtual('');
    } catch (err) {
      console.error('Erro ao salvar atendimento:', err);
      setErroAtendimento('Não foi possível gravar no servidor. O texto continua aqui (e salvo como rascunho neste navegador) — confira sua conexão e tente salvar de novo.');
    }
    setSalvandoAtendimento(false);
  };

  const salvarEdicaoRegistro = async () => {
    if (!registroEditando) return;
    setSalvandoEdicao(true);
    try {
      const atualizado = await comTimeout(registrosService.atualizar(registroEditando.id, registroEditando));
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
    setSalvandoClinicos(true);
    try {
      await comTimeout(pacientesService.atualizar(paciente.id, { ...paciente, ...novoClinicos }));
      setPacientes(pacientes.map((p) => p.id === paciente.id ? { ...p, ...novoClinicos } : p));
    } catch (err) {
      console.error('Erro ao salvar dados clínicos:', err);
    }
    setEditandoClinicos(false);
    setSalvandoClinicos(false);
  };

  const toggleComorbidade = (key, ciclo) => {
    if (!editandoClinicos) return;
    const idx = ciclo.indexOf(clinicos[key]);
    const proximo = ciclo[(idx + 1) % ciclo.length];
    setClinicos(prev => ({ ...prev, [key]: proximo }));
  };


  const coresTipo = {
    'Consulta': '#007bff', 'Atestado': '#28a745',
    'Receituário': '#f59e0b', 'Prescrição': '#8b5cf6', 'Relatório': '#6c757d',
    'Pedido de Exames': '#0891b2',
    'Laudo': '#7c3aed',
    'Sinais Vitais': '#16a34a',
    'Evolução de Enfermagem': '#0d9488',
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
                disabled={salvandoClinicos}
                style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: salvandoClinicos ? '#9ca3af' : (editandoClinicos ? '#28a745' : '#6c757d'), color: 'white', border: 'none', borderRadius: '3px', cursor: salvandoClinicos ? 'not-allowed' : 'pointer' }}
              >
                {salvandoClinicos ? 'Salvando...' : (editandoClinicos ? '✓ Salvar' : 'Editar')}
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

      <div ref={splitContainerRef} className="prontuario-split" style={{ marginTop: '16px', display: 'flex', alignItems: 'stretch', gap: '0', userSelect: isDragging.current ? 'none' : 'auto' }}>

        {/* Painel esquerdo — atendimento atual */}
        <div className="prontuario-split-left" style={{ ...painelStyle, width: splitPct + '%', borderRadius: '10px 0 0 10px', flexShrink: 0, overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>{enfermeiro ? 'Evolução de Enfermagem' : 'Atendimento Atual'}</h2>
          {rascunhoRestaurado && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '8px', fontSize: '13px', color: '#92400e' }}>
              <span>📝 Rascunho recuperado automaticamente (não salvo no prontuário ainda).</span>
              <button
                onClick={() => {
                  localStorage.removeItem(RASCUNHO_ATENDIMENTO_PREFIX + paciente.id);
                  setAtendimentoAtual('');
                  setRascunhoRestaurado(false);
                }}
                style={{ padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #92400e', color: '#92400e', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
              >
                Descartar
              </button>
            </div>
          )}
          <textarea
            placeholder={enfermeiro
              ? 'Evolução de enfermagem: cuidados realizados, resposta do paciente, intercorrências...'
              : 'História clínica, exame físico, hipótese diagnóstica, conduta...'}
            value={atendimentoAtual}
            onChange={(e) => setAtendimentoAtual(e.target.value)}
            rows={18}
            style={{ width: '100%', padding: '12px', fontSize: '15px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
          />
          <button
            onClick={salvarAtendimento}
            disabled={salvandoAtendimento}
            style={{ marginTop: '10px', padding: '12px 20px', backgroundColor: salvandoAtendimento ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoAtendimento ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {salvandoAtendimento ? 'Salvando...' : '✓ Salvar Atendimento'}
          </button>
          {erroAtendimento && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
              ⚠ {erroAtendimento}
            </p>
          )}
          {atendimentoAtual.trim() && (salvandoRascunho || rascunhoSalvoEm) && (
            <p style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
              {salvandoRascunho
                ? 'Salvando rascunho...'
                : `Rascunho salvo automaticamente às ${rascunhoSalvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — só vira registro oficial ao clicar em "Salvar Atendimento".`}
            </p>
          )}
          <div className="atalhos-grid">
            <Link to={`/sinais-vitais/${paciente.id}`} style={{ ...atalhoStyle, backgroundColor: '#16a34a' }}>🩺 Sinais Vitais</Link>
            {!enfermeiro && (
              <>
                <Link to={`/receituario/${paciente.id}`} style={atalhoStyle}>📋 Receituário</Link>
                <Link to={`/atestados/${paciente.id}`} style={atalhoStyle}>📄 Atestado</Link>
                <Link to={`/prescricao/${paciente.id}`} style={atalhoStyle}>💊 Prescrição</Link>
              </>
            )}
            <Link to={`/relatorios/${paciente.id}`} style={atalhoStyle}>🩺 Relatório</Link>
            <Link to={`/pedido-exames/${paciente.id}`} style={{ ...atalhoStyle, backgroundColor: '#0891b2' }}>🔬 Pedido de Exames</Link>
            <Link to={`/laudos/${paciente.id}`} style={{ ...atalhoStyle, backgroundColor: '#7c3aed' }}>📝 Laudos</Link>
          </div>
        </div>

        {/* Divisor arrastável — escondido no celular, onde os painéis ficam empilhados */}
        <div
          className="prontuario-split-divider"
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
        <div className="prontuario-split-right" style={{ ...painelStyle, flex: 1, borderRadius: '0 10px 10px 0', overflow: 'auto' }}>
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

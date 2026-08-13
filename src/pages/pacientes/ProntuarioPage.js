import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Header, painelStyle, atalhoStyle } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { registrosService } from '../../services/registros.service';
import { pacientesService } from '../../services/pacientes.service';
import { usuariosService } from '../../services/usuarios.service';
import { comTimeout } from '../../utils/comTimeout';
import { formatarData } from '../../utils/mascaras';
import { calcularIdade } from '../../utils/formatters';
import { lerRascunhoAtendimento, salvarRascunhoAtendimento } from '../../utils/rascunhoAtendimento';

// Preferência puramente visual (tamanho dos painéis) — sem dado clínico,
// por isso é seguro guardar direto no localStorage.
const SPLIT_KEY = 'pep_split_prontuario';

const TIPOS_HISTORICO = [
  'Consulta', 'Evolução de Enfermagem', 'Sinais Vitais', 'Receituário',
  'Prescrição', 'Atestado', 'Relatório', 'Pedido de Exames', 'Laudo',
];

export function ProntuarioPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user, funcao } = useAuth();
  const enfermeiro = funcao === 'Enfermeiro(a)';
  const { paciente } = usePacienteAtual(pacientes);
  const [atendimentoAtual, setAtendimentoAtual] = React.useState('');
  const [rascunhoRegistroId, setRascunhoRegistroId] = React.useState(null);
  const [registroAberto, setRegistroAberto] = React.useState(null);
  const [registroEditando, setRegistroEditando] = React.useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [editandoClinicos, setEditandoClinicos] = React.useState(false);
  const [salvandoAtendimento, setSalvandoAtendimento] = React.useState(false);
  const [erroAtendimento, setErroAtendimento] = React.useState('');
  const [salvandoClinicos, setSalvandoClinicos] = React.useState(false);
  const [erroClinicos, setErroClinicos] = React.useState('');
  const [processandoAssinaturaId, setProcessandoAssinaturaId] = React.useState(null);
  const [retificando, setRetificando] = React.useState(null); // { original, conteudo, motivo }
  const [salvandoRetificacao, setSalvandoRetificacao] = React.useState(false);
  const [usuarios, setUsuarios] = React.useState([]);
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const [buscaHistorico, setBuscaHistorico] = React.useState('');
  const [splitPct, setSplitPct] = React.useState(() => {
    const salvo = Number(localStorage.getItem(SPLIT_KEY));
    return salvo >= 25 && salvo <= 75 ? salvo : 55;
  });
  const isDragging = React.useRef(false);
  const splitContainerRef = React.useRef(null);
  const [rascunhoRestaurado, setRascunhoRestaurado] = React.useState(false);
  const [dadosClinicosAbertos, setDadosClinicosAbertos] = React.useState(true);

  React.useEffect(() => {
    usuariosService.listar().then(setUsuarios).catch(() => {});
  }, []);

  React.useEffect(() => { localStorage.setItem(SPLIT_KEY, String(splitPct)); }, [splitPct]);

  // Troca de paciente reinicia tudo que é específico do atendimento em
  // digitação — sem isso, texto (ou o id de um rascunho salvo) do
  // paciente anterior vazaria para a tela do paciente novo.
  React.useEffect(() => {
    if (!paciente?.id) return;
    const { texto, registroId } = lerRascunhoAtendimento(paciente.id);
    setAtendimentoAtual(texto);
    setRascunhoRestaurado(!!texto);
    setRascunhoRegistroId(registroId);
    setErroAtendimento('');
    setErroClinicos('');
    setEditandoClinicos(false);
  }, [paciente?.id]);

  const salvarRascunhoLocal = React.useCallback((texto) => {
    if (!paciente?.id) return false;
    return salvarRascunhoAtendimento(paciente.id, texto, rascunhoRegistroId);
  }, [paciente?.id, rascunhoRegistroId]);

  const { isSaving: salvandoRascunhoLocal, lastSaved: rascunhoSalvoEm } = useAutoSave(atendimentoAtual, salvarRascunhoLocal, 1500);

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

  const autoriaTexto = (registro) => {
    if (registro.assinadoPorNome) {
      return registro.assinadoPorRegistro ? `${registro.assinadoPorNome} — ${registro.assinadoPorRegistro}` : registro.assinadoPorNome;
    }
    const autor = usuarios.find(u => u.id === registro.createdBy);
    if (!autor) return '';
    const rotulo = autor.funcao === 'Enfermeiro(a)' ? 'COREN' : 'CRM';
    const registroProf = autor.crm ? ` — ${rotulo}${autor.uf ? '/' + autor.uf : ''} ${autor.crm}` : '';
    return `${autor.nome}${registroProf}`;
  };

  const tituloAtendimento = enfermeiro ? 'Evolução de enfermagem' : 'Atendimento médico';
  const tipoAtendimento = enfermeiro ? 'Evolução de Enfermagem' : 'Consulta';

  const aplicarRegistroSalvo = (salvo) => {
    setPacientes(prev => prev.map(p => {
      if (p.id !== paciente.id) return p;
      const jaExiste = (p.registros || []).some(r => r.id === salvo.id);
      return {
        ...p,
        registros: jaExiste
          ? p.registros.map(r => r.id === salvo.id ? salvo : r)
          : [salvo, ...(p.registros || [])],
      };
    }));
  };

  const salvarComoRascunho = async () => {
    if (!atendimentoAtual.trim()) return;
    setSalvandoAtendimento(true);
    setErroAtendimento('');
    try {
      let salvo;
      if (rascunhoRegistroId) {
        salvo = await comTimeout(registrosService.atualizar(rascunhoRegistroId, {
          titulo: tituloAtendimento,
          conteudo: atendimentoAtual,
        }));
      } else {
        salvo = await comTimeout(registrosService.criar({
          tipo: tipoAtendimento,
          titulo: tituloAtendimento,
          conteudo: atendimentoAtual,
          status: 'Rascunho',
        }, paciente.id, user?.id));
        setRascunhoRegistroId(salvo.id);
        // Grava o vínculo já aqui (não esperar o debounce do autosave) —
        // se a aba fechar ou a página remontar nos próximos segundos,
        // o próximo "Salvar rascunho" precisa achar este id e atualizar
        // a mesma linha, não criar uma duplicata.
        salvarRascunhoAtendimento(paciente.id, atendimentoAtual, salvo.id);
      }
      aplicarRegistroSalvo(salvo);
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err);
      setErroAtendimento('Não foi possível gravar o rascunho no servidor. O texto continua aqui (e salvo neste navegador) — confira sua conexão e tente de novo.');
    }
    setSalvandoAtendimento(false);
  };

  const finalizarEAssinar = async () => {
    if (!atendimentoAtual.trim()) return;
    setSalvandoAtendimento(true);
    setErroAtendimento('');
    try {
      let salvo;
      if (rascunhoRegistroId) {
        await comTimeout(registrosService.atualizar(rascunhoRegistroId, {
          titulo: tituloAtendimento,
          conteudo: atendimentoAtual,
        }));
        salvo = await comTimeout(registrosService.assinar(rascunhoRegistroId));
      } else {
        salvo = await comTimeout(registrosService.criar({
          tipo: tipoAtendimento,
          titulo: tituloAtendimento,
          conteudo: atendimentoAtual,
          status: 'Assinado',
        }, paciente.id, user?.id));
      }
      aplicarRegistroSalvo(salvo);
      // Só limpa o rascunho e o texto quando o servidor confirma de verdade
      // — nunca antes, senão um erro de rede apaga o atendimento sem salvar.
      salvarRascunhoAtendimento(paciente.id, '', null);
      setRascunhoRestaurado(false);
      setAtendimentoAtual('');
      setRascunhoRegistroId(null);
    } catch (err) {
      console.error('Erro ao assinar atendimento:', err);
      setErroAtendimento('Não foi possível finalizar e assinar no servidor. O texto continua aqui (e salvo como rascunho neste navegador) — confira sua conexão e tente de novo.');
    }
    setSalvandoAtendimento(false);
  };

  const assinarRegistroDoHistorico = async (registro) => {
    setProcessandoAssinaturaId(registro.id);
    try {
      const atualizado = await comTimeout(registrosService.assinar(registro.id));
      aplicarRegistroSalvo(atualizado);
      if (registro.id === rascunhoRegistroId) {
        setRascunhoRegistroId(null);
        setAtendimentoAtual('');
        salvarRascunhoAtendimento(paciente.id, '', null);
      }
    } catch (err) {
      toast.error('Erro ao assinar: ' + err.message);
    } finally {
      setProcessandoAssinaturaId(null);
    }
  };

  const salvarEdicaoRegistro = async () => {
    if (!registroEditando) return;
    setSalvandoEdicao(true);
    try {
      const atualizado = await comTimeout(registrosService.atualizar(registroEditando.id, registroEditando));
      aplicarRegistroSalvo(atualizado);
      setRegistroEditando(null);
    } catch (err) {
      toast.error('Erro ao salvar edição: ' + err.message);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const iniciarRetificacao = (registro) => {
    setRetificando({ original: registro, conteudo: registro.conteudo, motivo: '' });
  };

  const salvarRetificacao = async () => {
    if (!retificando?.motivo?.trim()) {
      toast.warning('Informe o motivo da retificação.');
      return;
    }
    setSalvandoRetificacao(true);
    try {
      const nova = await comTimeout(registrosService.retificar(
        { original: retificando.original, conteudo: retificando.conteudo, motivo: retificando.motivo.trim() },
        paciente.id,
        user?.id,
      ));
      aplicarRegistroSalvo(nova);
      setRetificando(null);
    } catch (err) {
      toast.error('Erro ao salvar retificação: ' + err.message);
    } finally {
      setSalvandoRetificacao(false);
    }
  };

  const salvarClinicos = async (novoClinicos = clinicos) => {
    setSalvandoClinicos(true);
    setErroClinicos('');
    try {
      await comTimeout(pacientesService.atualizarClinicos(paciente.id, novoClinicos));
      setPacientes(pacientes.map((p) => p.id === paciente.id ? { ...p, ...novoClinicos } : p));
      setEditandoClinicos(false);
    } catch (err) {
      console.error('Erro ao salvar dados clínicos:', err);
      setErroClinicos('Não foi possível salvar os dados clínicos. Revise a conexão e tente novamente.');
    }
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

  const STATUS_LABEL = { 'Rascunho': '📝 Rascunho', 'Assinado': '🔒 Assinado', 'Cancelado': '✕ Cancelado' };

  const registrosFiltrados = registros.filter(r => {
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    if (buscaHistorico.trim()) {
      const alvo = `${r.titulo} ${r.conteudo}`.toLowerCase();
      if (!alvo.includes(buscaHistorico.trim().toLowerCase())) return false;
    }
    return true;
  });

  // registrosFiltrados já vem ordenado (created_at desc) de
  // registrosService — agrupar preservando a ordem mantém os grupos em
  // ordem cronológica decrescente sem precisar reordenar nada.
  const gruposPorData = [];
  registrosFiltrados.forEach(r => {
    const grupo = gruposPorData[gruposPorData.length - 1];
    if (grupo && grupo.data === r.data) grupo.itens.push(r);
    else gruposPorData.push({ data: r.data, itens: [r] });
  });

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar para pacientes</Link>
      {/* Faixa horizontal fixa: dados do paciente + dados clínicos */}
      <div className="prontuario-topo" style={{ ...painelStyle, marginTop: '16px', display: 'flex', gap: '0', alignItems: 'flex-start', flexWrap: 'wrap', position: 'sticky', top: '0', zIndex: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>

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
        <div className="prontuario-separador-vertical" style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#e5e7eb', margin: '0 20px', flexShrink: 0 }} />

        {/* Dados clínicos */}
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button
              onClick={() => setDadosClinicosAbertos(v => !v)}
              className="prontuario-toggle-clinicos"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <strong style={{ fontSize: '13px' }}>Dados Clínicos</strong>
              <span style={{ fontSize: '11px', color: '#888' }}>{dadosClinicosAbertos ? '▲' : '▼'}</span>
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              {editandoClinicos && (
                <button onClick={() => { setEditandoClinicos(false); setErroClinicos(''); }} style={{ padding: '2px 6px', fontSize: '11px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
              )}
              <button
                onClick={() => {
                  if (editandoClinicos) { salvarClinicos(); return; }
                  setEditandoClinicos(true);
                  setErroClinicos('');
                }}
                disabled={salvandoClinicos}
                style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: salvandoClinicos ? '#9ca3af' : (editandoClinicos ? '#28a745' : '#6c757d'), color: 'white', border: 'none', borderRadius: '3px', cursor: salvandoClinicos ? 'not-allowed' : 'pointer' }}
              >
                {salvandoClinicos ? 'Salvando...' : (editandoClinicos ? '✓ Salvar' : 'Editar')}
              </button>
            </div>
          </div>

          {erroClinicos && (
            <div style={{ fontSize: '12px', color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' }}>
              ⚠ {erroClinicos}
            </div>
          )}

          {dadosClinicosAbertos && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div ref={splitContainerRef} className="prontuario-split" style={{ marginTop: '16px', display: 'flex', alignItems: 'stretch', gap: '0', userSelect: isDragging.current ? 'none' : 'auto' }}>

        {/* Painel esquerdo — atendimento atual */}
        <div className="prontuario-split-left" style={{ ...painelStyle, width: splitPct + '%', borderRadius: '10px 0 0 10px', flexShrink: 0, overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>{enfermeiro ? 'Evolução de Enfermagem' : 'Atendimento Atual'}</h2>
          {rascunhoRestaurado && !rascunhoRegistroId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '8px', fontSize: '13px', color: '#92400e' }}>
              <span>📝 Rascunho recuperado automaticamente (não salvo no prontuário ainda).</span>
              <button
                onClick={() => {
                  salvarRascunhoAtendimento(paciente.id, '', null);
                  setAtendimentoAtual('');
                  setRascunhoRestaurado(false);
                  setRascunhoRegistroId(null);
                }}
                style={{ padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #92400e', color: '#92400e', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
              >
                Descartar
              </button>
            </div>
          )}
          {rascunhoRegistroId && (
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px' }}>
              📝 Rascunho salvo no prontuário, ainda não assinado — outros profissionais já conseguem vê-lo no histórico.
            </p>
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
          <div className="prontuario-atendimento-acoes" style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={salvarComoRascunho}
              disabled={salvandoAtendimento || !atendimentoAtual.trim()}
              style={{ padding: '12px 18px', backgroundColor: (salvandoAtendimento || !atendimentoAtual.trim()) ? '#9ca3af' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: (salvandoAtendimento || !atendimentoAtual.trim()) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {salvandoAtendimento ? 'Salvando...' : '💾 Salvar rascunho'}
            </button>
            <button
              onClick={finalizarEAssinar}
              disabled={salvandoAtendimento || !atendimentoAtual.trim()}
              style={{ padding: '12px 20px', backgroundColor: (salvandoAtendimento || !atendimentoAtual.trim()) ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: (salvandoAtendimento || !atendimentoAtual.trim()) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {salvandoAtendimento ? 'Salvando...' : '🔒 Finalizar e Assinar'}
            </button>
          </div>
          <p style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
            Depois de assinado, o conteúdo não pode mais ser editado — uma correção posterior vira uma retificação, mantendo o texto original.
          </p>
          {erroAtendimento && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
              ⚠ {erroAtendimento}
            </p>
          )}
          {atendimentoAtual.trim() && (salvandoRascunhoLocal || rascunhoSalvoEm) && (
            <p style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
              {salvandoRascunhoLocal
                ? 'Salvando rascunho neste navegador...'
                : `Rascunho salvo neste navegador às ${rascunhoSalvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — só vira registro do prontuário ao clicar em "Salvar rascunho" ou "Finalizar e Assinar".`}
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
          <h2 style={{ marginTop: 0 }}>Histórico ({registrosFiltrados.length}{registrosFiltrados.length !== registros.length ? ` de ${registros.length}` : ''})</h2>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '7px', fontSize: '13px', flex: '1', minWidth: '140px' }}>
              <option value="">Todos os tipos</option>
              {TIPOS_HISTORICO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={buscaHistorico}
              onChange={e => setBuscaHistorico(e.target.value)}
              placeholder="Buscar no histórico..."
              style={{ padding: '7px', fontSize: '13px', flex: '2', minWidth: '160px' }}
            />
          </div>

          {registrosFiltrados.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px' }}>
              {registros.length === 0 ? 'Nenhum registro ainda.' : 'Nenhum registro encontrado com esse filtro.'}
            </p>
          ) : (
            gruposPorData.map(grupo => (
              <div key={grupo.data} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>
                  {grupo.data}
                </div>
                {grupo.itens.map((registro) => {
                  const cor = coresTipo[registro.tipo] || '#007bff';
                  const aberto = registroAberto === registro.id;
                  const editando = registroEditando?.id === registro.id;
                  const retificandoEste = retificando?.original.id === registro.id;
                  const podeEditar = registro.status === 'Rascunho' && registro.createdBy === user?.id;
                  const podeAssinar = registro.status === 'Rascunho' && registro.createdBy === user?.id;
                  const podeRetificar = registro.status === 'Assinado' && registro.createdBy === user?.id && !registro.retificacaoDe;
                  const adendos = registros.filter(r => r.retificacaoDe === registro.id);
                  return (
                    <div key={registro.id} style={{ marginBottom: '8px' }}>
                      {/* Cabeçalho clicável */}
                      <div
                        onClick={() => !editando && !retificandoEste && setRegistroAberto(aberto ? null : registro.id)}
                        style={{ borderLeft: `4px solid ${cor}`, backgroundColor: aberto || editando || retificandoEste ? '#f0f7ff' : '#f8f9fa', padding: '8px 10px', borderRadius: aberto || editando || retificandoEste ? '6px 6px 0 0' : '6px', cursor: (editando || retificandoEste) ? 'default' : 'pointer', userSelect: 'none' }}
                        title="Clique para expandir"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', backgroundColor: cor, color: 'white', padding: '1px 7px', borderRadius: '10px' }}>{registro.tipo}</span>
                            <span style={{ fontSize: '10px', color: '#666' }}>{STATUS_LABEL[registro.status] || registro.status}</span>
                            {registro.retificacaoDe && <span style={{ fontSize: '10px', color: '#b45309' }}>🔁 Retificação</span>}
                          </div>
                          <span style={{ fontSize: '11px', color: '#666' }}>{registro.hora}</span>
                        </div>
                        <p style={{ margin: '4px 0 2px', fontSize: '13px', fontWeight: '500' }}>{registro.titulo}</p>
                        <div style={{ fontSize: '11px', color: '#888' }}>{autoriaTexto(registro)}</div>
                        {!editando && !retificandoEste && (
                          <small style={{ color: cor, fontSize: '11px' }}>{aberto ? '▲ Fechar' : '▼ Ver detalhes'}</small>
                        )}
                      </div>

                      {/* Conteúdo expandido — modo leitura */}
                      {aberto && !editando && !retificandoEste && (
                        <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderTop: 'none', padding: '10px 12px', borderRadius: '0 0 6px 6px' }}>
                          {registro.retificacaoDe && registro.motivoRetificacao && (
                            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '6px 8px' }}>
                              <strong>Motivo da retificação:</strong> {registro.motivoRetificacao}
                            </p>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.6', maxHeight: '280px', overflowY: 'auto', marginBottom: '8px' }}>
                            {registro.conteudo}
                          </div>

                          {adendos.length > 0 && (
                            <div style={{ marginBottom: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
                              <strong style={{ fontSize: '11px', color: '#92400e' }}>Adendos / retificações:</strong>
                              {adendos.map(ad => (
                                <div key={ad.id} style={{ fontSize: '12px', color: '#555', marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #fde68a' }}>
                                  {ad.data} {ad.hora} — {ad.motivoRetificacao} <span style={{ color: '#999' }}>({autoriaTexto(ad)})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`/imprimir/${paciente.id}/${registro.id}`, '_blank'); }}
                              style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🖨️ Imprimir
                            </button>
                            {podeEditar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setRegistroEditando({ id: registro.id, titulo: registro.titulo, conteudo: registro.conteudo }); }}
                                style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f0f7ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ✏️ Editar rascunho
                              </button>
                            )}
                            {podeAssinar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); assinarRegistroDoHistorico(registro); }}
                                disabled={processandoAssinaturaId === registro.id}
                                style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '4px', cursor: processandoAssinaturaId === registro.id ? 'not-allowed' : 'pointer' }}
                              >
                                {processandoAssinaturaId === registro.id ? 'Assinando...' : '🔒 Assinar'}
                              </button>
                            )}
                            {podeRetificar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); iniciarRetificacao(registro); }}
                                style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                📝 Retificar
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Modo edição inline (só rascunho) */}
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

                      {/* Formulário de retificação */}
                      {retificandoEste && (
                        <div style={{ backgroundColor: 'white', border: '1px solid #f59e0b', borderTop: 'none', padding: '12px', borderRadius: '0 0 6px 6px' }}>
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#92400e' }}>
                            O registro original não será alterado — isto cria uma nova entrada vinculada a ele.
                          </p>
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Motivo da retificação *</label>
                            <input
                              value={retificando.motivo}
                              onChange={e => setRetificando({ ...retificando, motivo: e.target.value })}
                              placeholder="Ex: correção de dose prescrita"
                              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Conteúdo da retificação</label>
                            <textarea
                              value={retificando.conteudo}
                              onChange={e => setRetificando({ ...retificando, conteudo: e.target.value })}
                              rows={6}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={salvarRetificacao}
                              disabled={salvandoRetificacao}
                              style={{ padding: '6px 14px', backgroundColor: salvandoRetificacao ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoRetificacao ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            >
                              {salvandoRetificacao ? 'Salvando...' : '✓ Salvar retificação'}
                            </button>
                            <button
                              onClick={() => setRetificando(null)}
                              style={{ padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

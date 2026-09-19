import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Header, painelStyle, atalhoStyle } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { registrosService, aplicarRegistroConfirmado, confirmarRecebimentoRegistro } from '../../services/registros.service';
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

export function ProntuarioPage(props) {
  const { id } = useParams();
  return <ProntuarioConteudo key={id} {...props} />;
}

function ProntuarioConteudo({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user, funcao } = useAuth();
  const enfermeiro = funcao === 'Enfermeiro(a)';
  const { paciente } = usePacienteAtual(pacientes);
  const [atendimentoAtual, setAtendimentoAtual] = React.useState('');
  const [rascunhoRegistroId, setRascunhoRegistroId] = React.useState(null);
  const [rascunhoVersao, setRascunhoVersao] = React.useState(null);
  const [conflito, setConflito] = React.useState(null);
  const [registroAberto, setRegistroAberto] = React.useState(null);
  const [registroEditando, setRegistroEditando] = React.useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [editandoClinicos, setEditandoClinicos] = React.useState(false);
  const [salvandoAtendimento, setSalvandoAtendimento] = React.useState(false);
  const [erroAtendimento, setErroAtendimento] = React.useState('');
  const [erroStorage, setErroStorage] = React.useState('');
  const [erroHistorico, setErroHistorico] = React.useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = React.useState(true);
  const [tentativaHistorico, setTentativaHistorico] = React.useState(0);
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
  const cabecalhosFixosRef = React.useRef(null);
  const [alturaCabecalhosFixos, setAlturaCabecalhosFixos] = React.useState(0);
  const [rascunhoRestaurado, setRascunhoRestaurado] = React.useState(false);
  const [dadosClinicosAbertos, setDadosClinicosAbertos] = React.useState(true);

  React.useLayoutEffect(() => {
    const elemento = cabecalhosFixosRef.current;
    if (!elemento) return undefined;

    const medir = () => setAlturaCabecalhosFixos(Math.ceil(elemento.getBoundingClientRect().height));
    medir();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observer?.observe(elemento);
    window.addEventListener('resize', medir);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [dadosClinicosAbertos, editandoClinicos, erroClinicos]);

  React.useEffect(() => {
    usuariosService.listar().then(setUsuarios).catch(() => {});
  }, []);

  React.useEffect(() => { localStorage.setItem(SPLIT_KEY, String(splitPct)); }, [splitPct]);

  // Troca de paciente reinicia tudo que é específico do atendimento em
  // digitação — sem isso, texto (ou o id de um rascunho salvo) do
  // paciente anterior vazaria para a tela do paciente novo.
  React.useEffect(() => {
    if (!paciente?.id) return;
    setErroStorage('');
    try {
      const { texto, registroId, versao } = lerRascunhoAtendimento(paciente.id, user?.id);
      setAtendimentoAtual(texto);
      setRascunhoRestaurado(!!texto);
      setRascunhoRegistroId(registroId);
      setRascunhoVersao(versao);
    } catch {
      setAtendimentoAtual('');
      setRascunhoRestaurado(false);
      setRascunhoRegistroId(null);
      setRascunhoVersao(null);
      setErroStorage('Não foi possível recuperar o rascunho temporário desta aba. Confira os rascunhos salvos no histórico.');
    }
    setErroAtendimento('');
    setErroClinicos('');
    setEditandoClinicos(false);
  }, [paciente?.id, user?.id]);

  const salvarRascunhoLocal = React.useCallback((texto) => {
    if (!paciente?.id) return false;
    return salvarRascunhoAtendimento(paciente.id, texto, rascunhoRegistroId, user?.id, rascunhoVersao);
  }, [paciente?.id, rascunhoRegistroId, user?.id, rascunhoVersao]);

  const { isSaving: salvandoRascunhoLocal, lastSaved: rascunhoSalvoEm, error: erroRascunhoLocal } = useAutoSave(atendimentoAtual, salvarRascunhoLocal, 1500);

  const persistirRascunhoLocal = (texto, registroId, versao = null) => {
    try {
      salvarRascunhoAtendimento(paciente.id, texto, registroId, user?.id, versao);
      setErroStorage('');
      return true;
    } catch {
      // Uma falha local não pode transformar uma gravação já confirmada
      // no servidor em "erro ao salvar" e induzir uma segunda inserção.
      setErroStorage('Não foi possível atualizar o rascunho temporário desta aba. Confira o registro salvo no histórico.');
      return false;
    }
  };

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
    medicamentosUso: '', alergias: '', outrasComorbidades: ''
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
        outrasComorbidades: p.outrasComorbidades || '',
      });
    }
  }, [paciente?.id, setPacientes]);

  React.useEffect(() => {
    if (!paciente?.id) return;
    const pacienteId = paciente.id;
    let cancelado = false;
    setCarregandoHistorico(true);
    setErroHistorico(false);
    comTimeout(registrosService.listarPorPaciente(pacienteId))
      .then(registros => {
        if (!cancelado) setPacientes(prev => prev.map(p =>
          p.id === pacienteId ? { ...p, registros } : p));
      })
      .catch(() => { if (!cancelado) setErroHistorico(true); })
      .finally(() => { if (!cancelado) setCarregandoHistorico(false); });
    return () => { cancelado = true; };
  }, [paciente?.id, setPacientes, tentativaHistorico]);

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

  const aplicarRegistroSalvo = salvo => aplicarRegistroConfirmado(setPacientes, paciente.id, salvo);

  const gravarAtendimento = async (assinar) => {
    if (!atendimentoAtual.trim() || salvandoAtendimento) return;
    setSalvandoAtendimento(true);
    setErroAtendimento('');
    try {
      const salvo = rascunhoRegistroId
        ? await registrosService.atualizar(rascunhoRegistroId, {
          titulo: tituloAtendimento, conteudo: atendimentoAtual,
          pacienteId: paciente.id, versao: rascunhoVersao,
        }, user?.id, assinar)
        : await registrosService.criar({
          tipo: tipoAtendimento, titulo: tituloAtendimento, conteudo: atendimentoAtual,
          status: assinar ? 'Assinado' : 'Rascunho',
        }, paciente.id, user?.id);
      aplicarRegistroSalvo(salvo);
      setConflito(null);
      if (salvo.status === 'Assinado') {
        if (persistirRascunhoLocal('', null)) confirmarRecebimentoRegistro(salvo);
        setAtendimentoAtual('');
        setRascunhoRegistroId(null);
        setRascunhoVersao(null);
        setRascunhoRestaurado(false);
      } else {
        setRascunhoRegistroId(salvo.id);
        setRascunhoVersao(salvo.versao);
        if (persistirRascunhoLocal(atendimentoAtual, salvo.id, salvo.versao)) confirmarRecebimentoRegistro(salvo);
      }
    } catch (err) {
      if (err.registroConfirmado) {
        const confirmado = err.registroConfirmado;
        aplicarRegistroSalvo(confirmado);
        setRascunhoRegistroId(confirmado.id);
        setRascunhoVersao(confirmado.versao);
        if (persistirRascunhoLocal(atendimentoAtual, confirmado.id, confirmado.versao)) confirmarRecebimentoRegistro(confirmado);
        setConflito({ alvo: 'atendimento', id: confirmado.id, atual: confirmado });
      } else if (err.code === 'P4090' || (rascunhoRegistroId && !rascunhoVersao)) {
        setConflito({ alvo: 'atendimento', id: rascunhoRegistroId });
      }
      setErroAtendimento(err.message);
    } finally {
      setSalvandoAtendimento(false);
    }
  };

  const salvarComoRascunho = () => gravarAtendimento(false);
  const finalizarEAssinar = () => gravarAtendimento(true);

  const carregarVersaoAtual = async () => {
    try {
      const atual = await comTimeout(registrosService.buscarPorId(conflito.id));
      setConflito(anterior => anterior?.id === atual.id ? { ...anterior, atual } : anterior);
      aplicarRegistroSalvo(atual);
    } catch {
      toast.error('Não foi possível consultar a versão atual. Seu texto continua preservado.');
    }
  };

  const resolverConflito = (manterTexto) => {
    if (conflito.alvo === 'edicao' && registroEditando?.id !== conflito.id) {
      setConflito(null);
      return;
    }
    const atual = conflito.atual;
    if (conflito.alvo === 'atendimento') {
      const texto = manterTexto ? atendimentoAtual : atual.conteudo;
      setAtendimentoAtual(texto);
      setRascunhoRegistroId(atual.id);
      setRascunhoVersao(atual.versao);
      persistirRascunhoLocal(texto, atual.id, atual.versao);
      setErroAtendimento('');
    } else {
      setRegistroEditando(anterior => ({
        ...anterior, versao: atual.versao, pacienteId: atual.pacienteId,
        ...(manterTexto ? {} : { titulo: atual.titulo, conteudo: atual.conteudo }),
      }));
    }
    setConflito(null);
  };

  const assinarRegistroDoHistorico = async (registro) => {
    if (registro.id === rascunhoRegistroId && atendimentoAtual !== registro.conteudo) {
      toast.warning('Há alterações no atendimento atual. Use Finalizar e Assinar para salvar e assinar esse texto.');
      return;
    }
    setProcessandoAssinaturaId(registro.id);
    try {
      const atualizado = await registrosService.assinar(registro, user?.id);
      aplicarRegistroSalvo(atualizado);
      if (registro.id === rascunhoRegistroId) {
        setRascunhoRegistroId(null);
        setRascunhoVersao(null);
        setAtendimentoAtual('');
        if (persistirRascunhoLocal('', null)) confirmarRecebimentoRegistro(atualizado);
      } else confirmarRecebimentoRegistro(atualizado);
    } catch (err) {
      toast.error('Erro ao assinar: ' + err.message);
      setTentativaHistorico(valor => valor + 1);
    } finally {
      setProcessandoAssinaturaId(null);
    }
  };

  const salvarEdicaoRegistro = async () => {
    if (!registroEditando) return;
    setSalvandoEdicao(true);
    try {
      const atualizado = await registrosService.atualizar(registroEditando.id, registroEditando, user?.id);
      aplicarRegistroSalvo(atualizado);
      confirmarRecebimentoRegistro(atualizado);
      setRegistroEditando(null);
    } catch (err) {
      if (err.registroConfirmado) { aplicarRegistroSalvo(err.registroConfirmado); confirmarRecebimentoRegistro(err.registroConfirmado); }
      if (err.code === 'P4090' || err.registroConfirmado) setConflito({ alvo: 'edicao', id: registroEditando.id, atual: err.registroConfirmado });
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
      const nova = await registrosService.retificar(
        { original: retificando.original, conteudo: retificando.conteudo, motivo: retificando.motivo.trim() },
        paciente.id,
        user?.id,
      );
      aplicarRegistroSalvo(nova);
      confirmarRecebimentoRegistro(nova);
      setRetificando(null);
    } catch (err) {
      if (err.registroConfirmado) { aplicarRegistroSalvo(err.registroConfirmado); confirmarRecebimentoRegistro(err.registroConfirmado); }
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
      const detalhe = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''}`.toLowerCase();
      const bancoDesatualizado = detalhe.includes('outras_comorbidades')
        || detalhe.includes('schema cache')
        || detalhe.includes('pgrst204');
      setErroClinicos(
        bancoDesatualizado
          ? 'O banco de homologação ainda não recebeu a atualização do campo “Outras comorbidades”. Aplique a migração pendente e tente novamente.'
          : `Não foi possível salvar os dados clínicos. ${err?.message || 'Tente novamente em instantes.'}`
      );
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
    <div className="prontuario-page">
      <div ref={cabecalhosFixosRef} className="prontuario-cabecalhos-fixos">
        <Header />
        {/* Faixa horizontal fixa: dados do paciente + dados clínicos */}
        <div className="prontuario-topo" style={{ ...painelStyle, padding: '8px 12px', marginTop: '0', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>

        {/* Identificação do paciente */}
        <section className="prontuario-identificacao" aria-label="Identificação do paciente">
          <div className="prontuario-avatar" aria-hidden="true">👤</div>
          <div className="prontuario-identificacao-conteudo">
            <div className="prontuario-identidade-principal">
              <div className="prontuario-secao-label">Paciente</div>
              <h2 className="prontuario-paciente-nome">{paciente.nome}</h2>
            </div>
            <div className="prontuario-cadastro-grid">
              <div className="prontuario-dado-cadastro">
                <span>CPF</span>
                <strong>{paciente.cpf || '-'}</strong>
              </div>
              <div className="prontuario-dado-cadastro">
                <span>Nascimento</span>
                <strong>{formatarData(paciente.nascimento)}{paciente.nascimento ? ` · ${calcularIdade(paciente.nascimento)} anos` : ''}</strong>
              </div>
              <div className="prontuario-dado-cadastro">
                <span>Telefone</span>
                <strong>{paciente.telefone || '-'}</strong>
              </div>
              <div className="prontuario-dado-cadastro">
                <span>Convênio</span>
                <strong>{paciente.convenio || '-'}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Dados clínicos */}
        <section className="prontuario-clinicos" aria-label="Comorbidades e dados clínicos">
          <div className="prontuario-clinicos-cabecalho">
            <button
              onClick={() => setDadosClinicosAbertos(v => !v)}
              className="prontuario-toggle-clinicos"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              aria-expanded={dadosClinicosAbertos}
            >
              <span className="prontuario-secao-label">Dados clínicos e comorbidades</span>
              <span className="prontuario-toggle-icone" aria-hidden="true">{dadosClinicosAbertos ? '▲' : '▼'}</span>
            </button>
            <div className="prontuario-clinicos-acoes">
              {editandoClinicos && (
                <button onClick={() => { setEditandoClinicos(false); setErroClinicos(''); }} style={{ padding: '3px 7px', fontSize: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
              )}
              <button
                onClick={() => {
                  if (editandoClinicos) { salvarClinicos(); return; }
                  setEditandoClinicos(true);
                  setErroClinicos('');
                }}
                disabled={salvandoClinicos}
                style={{ padding: '3px 9px', fontSize: '12px', backgroundColor: salvandoClinicos ? '#9ca3af' : (editandoClinicos ? '#28a745' : '#6c757d'), color: 'white', border: 'none', borderRadius: '3px', cursor: salvandoClinicos ? 'not-allowed' : 'pointer' }}
              >
                {salvandoClinicos ? 'Salvando...' : (editandoClinicos ? '✓ Salvar' : 'Editar')}
              </button>
            </div>
          </div>

          {erroClinicos && (
            <div style={{ fontSize: '15px', color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' }}>
              ⚠ {erroClinicos}
            </div>
          )}

          {dadosClinicosAbertos && (
            <>
              {/* Botões de comorbidade — clique para ativar/desativar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
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
                        padding: '3px 10px',
                        backgroundColor: bg,
                        color,
                        border: `1px solid ${border}`,
                        borderRadius: '20px',
                        fontSize: '15px',
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

              {/* Informações de texto em cartões responsivos */}
              <div className="prontuario-clinicos-grid">
                <div className="prontuario-clinico-card">
                  <strong className="prontuario-clinico-label">Cirurgias</strong>
                  {editandoClinicos
                    ? <textarea className="prontuario-clinico-campo prontuario-clinico-campo-multilinha" value={clinicos.cirurgias} onChange={e => setClinicos({ ...clinicos, cirurgias: e.target.value })} rows={2} placeholder="Ex: Apendicectomia 2010" />
                    : <span className="prontuario-clinico-valor" style={{ color: clinicos.cirurgias ? '#333' : '#999' }}>{clinicos.cirurgias || '-'}</span>
                  }
                </div>
                <div className="prontuario-clinico-card">
                  <strong className="prontuario-clinico-label">Medicamentos em uso</strong>
                  {editandoClinicos
                    ? <textarea className="prontuario-clinico-campo prontuario-clinico-campo-multilinha" value={clinicos.medicamentosUso} onChange={e => setClinicos({ ...clinicos, medicamentosUso: e.target.value })} rows={2} placeholder="Informe os medicamentos em uso" />
                    : <span className="prontuario-clinico-valor" style={{ color: clinicos.medicamentosUso ? '#333' : '#999' }}>{clinicos.medicamentosUso || '-'}</span>
                  }
                </div>
                <div className={`prontuario-clinico-card prontuario-clinico-card-alergias${clinicos.alergias ? ' tem-alergia' : ''}`}>
                  <strong className="prontuario-clinico-label">Alergias</strong>
                  {editandoClinicos
                    ? <textarea className="prontuario-clinico-campo prontuario-alergias-campo" value={clinicos.alergias} onChange={e => setClinicos({ ...clinicos, alergias: e.target.value })} rows={3} placeholder="Informe medicamentos, substâncias ou alimentos" />
                    : <span className="prontuario-clinico-valor prontuario-alergias-valor" style={{ color: clinicos.alergias ? '#b91c1c' : '#999', fontWeight: clinicos.alergias ? 'bold' : 'normal' }}>{clinicos.alergias || '-'}</span>
                  }
                </div>
                <div className="prontuario-clinico-card">
                  <strong className="prontuario-clinico-label">Outras comorbidades</strong>
                  {editandoClinicos
                    ? <textarea className="prontuario-clinico-campo prontuario-outras-comorbidades-campo" value={clinicos.outrasComorbidades} onChange={e => setClinicos({ ...clinicos, outrasComorbidades: e.target.value })} rows={2} placeholder="Informe outras condições clínicas" />
                    : <span className="prontuario-clinico-valor prontuario-outras-comorbidades-valor" style={{ color: clinicos.outrasComorbidades ? '#333' : '#999' }}>{clinicos.outrasComorbidades || '-'}</span>
                  }
                </div>
              </div>
            </>
          )}
        </section>
        </div>
      </div>
      <div className="prontuario-cabecalhos-espaco" aria-hidden="true" style={{ height: `${alturaCabecalhosFixos}px` }} />

      <div ref={splitContainerRef} className="prontuario-split" style={{ marginTop: '16px', display: 'flex', alignItems: 'stretch', gap: '0', userSelect: isDragging.current ? 'none' : 'auto' }}>

        {/* Painel esquerdo — atendimento atual */}
        <div className="prontuario-split-left" style={{ ...painelStyle, width: splitPct + '%', borderRadius: '10px 0 0 10px', flexShrink: 0, overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>{enfermeiro ? 'Evolução de Enfermagem' : 'Atendimento Atual'}</h2>
          {rascunhoRestaurado && !rascunhoRegistroId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '8px', fontSize: '16px', color: '#92400e' }}>
              <span>📝 Rascunho recuperado automaticamente (não salvo no prontuário ainda).</span>
              <button
                onClick={() => {
                  persistirRascunhoLocal('', null);
                  setAtendimentoAtual('');
                  setRascunhoRestaurado(false);
                  setRascunhoRegistroId(null);
        setRascunhoVersao(null);
                }}
                style={{ padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #92400e', color: '#92400e', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}
              >
                Descartar
              </button>
            </div>
          )}
          {rascunhoRegistroId && (
            <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px' }}>
              📝 Rascunho salvo no prontuário, ainda não assinado — visível ao autor e à administração.
            </p>
          )}
          <textarea
            placeholder={enfermeiro
              ? 'Evolução de enfermagem: cuidados realizados, resposta do paciente, intercorrências...'
              : 'História clínica, exame físico, hipótese diagnóstica, conduta...'}
            disabled={salvandoAtendimento}
            value={atendimentoAtual}
            onChange={(e) => setAtendimentoAtual(e.target.value)}
            rows={18}
            style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
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
          <p style={{ marginTop: '6px', fontSize: '16px', color: '#888' }}>
            Antes de fechar esta aba ou sair da conta, clique em Salvar rascunho para guardar o texto no prontuário.
          </p>
          {(erroStorage || erroRascunhoLocal) && <p role="alert">
            {erroStorage || 'Não foi possível guardar o rascunho nesta aba. Salve no prontuário antes de sair.'}
          </p>}
          <p style={{ marginTop: '6px', fontSize: '16px', color: '#888' }}>
            Depois de assinado, o conteúdo não pode mais ser editado — uma correção posterior vira uma retificação, mantendo o texto original.
          </p>
          {erroAtendimento && (
            <p style={{ marginTop: '8px', fontSize: '16px', color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
              ⚠ {erroAtendimento}
            </p>
          )}
          {atendimentoAtual.trim() && (salvandoRascunhoLocal || rascunhoSalvoEm) && (
            <p style={{ marginTop: '6px', fontSize: '16px', color: '#888' }}>
              {salvandoRascunhoLocal
                ? 'Salvando rascunho nesta aba...'
                : `Rascunho salvo nesta aba às ${rascunhoSalvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — só vira registro do prontuário ao clicar em "Salvar rascunho" ou "Finalizar e Assinar".`}
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
        <div className="prontuario-split-right prontuario-historico" style={{ ...painelStyle, flex: 1, borderRadius: '0 10px 10px 0', overflow: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Histórico</h2>
          {conflito && <section role="alert" style={{ border: '1px solid #d97706', padding: '12px', marginBottom: '12px' }}>
            <p>Seu texto foi preservado. Compare com o registro atual antes de continuar.</p>
            <button onClick={carregarVersaoAtual}>Consultar versão atual</button>
            {conflito.atual && <>
              <p>Versão {conflito.atual.versao} — {conflito.atual.status}</p>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{conflito.atual.conteudo}</pre>
              {conflito.atual.status === 'Rascunho' ? <>
                <button onClick={() => resolverConflito(false)}>Usar o texto da versão atual</button>
                <button onClick={() => resolverConflito(true)}>Manter meu texto sobre esta versão</button>
              </> : <>
                <p>Este registro já está assinado. Uma correção exige retificação.</p>
                <button onClick={() => {
                  setRetificando({ original: conflito.atual, conteudo: conflito.alvo === 'atendimento' ? atendimentoAtual : registroEditando?.conteudo || '', motivo: '' });
                  if (conflito.alvo === 'atendimento') {
                    setAtendimentoAtual('');
                    setRascunhoRegistroId(null);
                    setRascunhoVersao(null);
                    persistirRascunhoLocal('', null);
                    setErroAtendimento('');
                  } else setRegistroEditando(null);
                  setRegistroAberto(conflito.id);
                  setConflito(null);
                }}>Criar retificação com meu texto</button>
              </>}
            </>}
          </section>}
          <button disabled={carregandoHistorico} onClick={() => setTentativaHistorico(valor => valor + 1)}>
            Atualizar histórico
          </button>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '7px', fontSize: '16px', flex: '1', minWidth: '140px' }}>
              <option value="">Todos os tipos</option>
              {TIPOS_HISTORICO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={buscaHistorico}
              onChange={e => setBuscaHistorico(e.target.value)}
              placeholder="Buscar no histórico..."
              style={{ padding: '7px', fontSize: '16px', flex: '2', minWidth: '160px' }}
            />
          </div>

          {carregandoHistorico ? <p role="status">Carregando histórico...</p> : erroHistorico ? (
            <p role="alert">Não foi possível carregar o histórico. Verifique sua conexão e clique em Atualizar histórico.</p>
          ) : registrosFiltrados.length === 0 ? (
            <p style={{ color: '#999', fontSize: '16px' }}>
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
                        <p style={{ margin: '4px 0 2px', fontSize: '16px', fontWeight: '500' }}>{registro.titulo}</p>
                        <div style={{ fontSize: '11px', color: '#888' }}>{autoriaTexto(registro)}</div>
                        {!editando && !retificandoEste && (
                          <small style={{ color: cor, fontSize: '11px' }}>{aberto ? '▲ Fechar' : '▼ Ver detalhes'}</small>
                        )}
                      </div>

                      {/* Conteúdo expandido — modo leitura */}
                      {aberto && !editando && !retificandoEste && (
                        <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderTop: 'none', padding: '10px 12px', borderRadius: '0 0 6px 6px' }}>
                          {registro.retificacaoDe && registro.motivoRetificacao && (
                            <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '6px 8px' }}>
                              <strong>Motivo da retificação:</strong> {registro.motivoRetificacao}
                            </p>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: '1.6', maxHeight: '280px', overflowY: 'auto', marginBottom: '8px' }}>
                            {registro.conteudo}
                          </div>

                          {adendos.length > 0 && (
                            <div style={{ marginBottom: '8px', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
                              <strong style={{ fontSize: '11px', color: '#92400e' }}>Adendos / retificações:</strong>
                              {adendos.map(ad => (
                                <div key={ad.id} style={{ fontSize: '16px', color: '#555', marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #fde68a' }}>
                                  {ad.data} {ad.hora} — {ad.motivoRetificacao} <span style={{ color: '#999' }}>({autoriaTexto(ad)})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`/imprimir/${paciente.id}/${registro.id}`, '_blank'); }}
                              style={{ fontSize: '16px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🖨️ Imprimir
                            </button>
                            {podeEditar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConflito(null); setRegistroEditando({ ...registro, pacienteId: paciente.id }); }}
                                style={{ fontSize: '16px', padding: '4px 10px', backgroundColor: '#f0f7ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ✏️ Editar rascunho
                              </button>
                            )}
                            {podeAssinar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); assinarRegistroDoHistorico(registro); }}
                                disabled={processandoAssinaturaId === registro.id}
                                style={{ fontSize: '16px', padding: '4px 10px', backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '4px', cursor: processandoAssinaturaId === registro.id ? 'not-allowed' : 'pointer' }}
                              >
                                {processandoAssinaturaId === registro.id ? 'Assinando...' : '🔒 Assinar'}
                              </button>
                            )}
                            {podeRetificar && (
                              <button
                                onClick={(e) => { e.stopPropagation(); iniciarRetificacao(registro); }}
                                style={{ fontSize: '16px', padding: '4px 10px', backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: '4px', cursor: 'pointer' }}
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
                            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Título</label>
                            <input
                              disabled={salvandoEdicao}
                              value={registroEditando.titulo}
                              onChange={e => setRegistroEditando({ ...registroEditando, titulo: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Conteúdo</label>
                            <textarea
                              disabled={salvandoEdicao}
                              value={registroEditando.conteudo}
                              onChange={e => setRegistroEditando({ ...registroEditando, conteudo: e.target.value })}
                              rows={6}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={salvarEdicaoRegistro}
                              disabled={salvandoEdicao}
                              style={{ padding: '6px 14px', backgroundColor: salvandoEdicao ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoEdicao ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                            >
                              {salvandoEdicao ? 'Salvando...' : '✓ Salvar'}
                            </button>
                            <button
                              onClick={() => { setRegistroEditando(null); if (conflito?.alvo === 'edicao') setConflito(null); }}
                              style={{ padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Formulário de retificação */}
                      {retificandoEste && (
                        <div style={{ backgroundColor: 'white', border: '1px solid #f59e0b', borderTop: 'none', padding: '12px', borderRadius: '0 0 6px 6px' }}>
                          <p style={{ margin: '0 0 8px', fontSize: '16px', color: '#92400e' }}>
                            O registro original não será alterado — isto cria uma nova entrada vinculada a ele.
                          </p>
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Motivo da retificação *</label>
                            <input
                              disabled={salvandoRetificacao}
                              value={retificando.motivo}
                              onChange={e => setRetificando({ ...retificando, motivo: e.target.value })}
                              placeholder="Ex: correção de dose prescrita"
                              style={{ width: '100%', padding: '6px 8px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            />
                          </div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#374151' }}>Conteúdo da retificação</label>
                            <textarea
                              disabled={salvandoRetificacao}
                              value={retificando.conteudo}
                              onChange={e => setRetificando({ ...retificando, conteudo: e.target.value })}
                              rows={6}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={salvarRetificacao}
                              disabled={salvandoRetificacao}
                              style={{ padding: '6px 14px', backgroundColor: salvandoRetificacao ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoRetificacao ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                            >
                              {salvandoRetificacao ? 'Salvando...' : '✓ Salvar retificação'}
                            </button>
                            <button
                              onClick={() => setRetificando(null)}
                              style={{ padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
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

import { dataLocalISO } from '../../utils/formatters';
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { Header, CabecalhoImpresso, RodapeImpresso } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { pacientesService } from '../../services/pacientes.service';
import { usuariosService } from '../../services/usuarios.service';
import { procedimentosService } from '../../services/procedimentos.service';
import { conveniosService } from '../../services/convenios.service';
import { cobrancasService } from '../../services/cobrancas.service';
import { comTimeout } from '../../utils/comTimeout';
import { registrarImpressao } from '../../services/acessos.service';
import { useBuscaPacientes, usePacientesPorIds } from '../../hooks/usePacientesCache';
import { FUNCOES_CLINICAS, FUNCOES_FINANCEIRO } from '../../constants/roles';
import { EscolhaProcedimento, useCatalogo } from '../agenda/SeletorProcedimento';
import { formatarMoeda } from '../../utils/formatters';

export { formatarMoeda };

export const COBRANCA_STATUS_CORES = { 'Pendente': '#f59e0b', 'Pago': '#28a745', 'Cancelado': '#6c757d', 'Glosado': '#ef4444' };

export function NovaCobrancaForm({ pacientes, convenios, medicos, userId, onCriado, onCancelar }) {
  const [busca, setBusca] = React.useState('');
  const [pacienteId, setPacienteId] = React.useState('');
  const [procedimentoId, setProcedimentoId] = React.useState('');
  const [convenioId, setConvenioId] = React.useState('');
  const [medicoId, setMedicoId] = React.useState('');
  const [valor, setValor] = React.useState('');
  const [formaPagamento, setFormaPagamento] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  // Busca no servidor (8 primeiros); o escolhido já fica no cache.
  const { itens: pacientesFiltrados } = useBuscaPacientes(busca, { limite: 8 });
  const pacienteSelecionado = pacientes.find(p => p.id === pacienteId);
  // Valor da tabela do convênio escolhido (ou particular) — migração 50.
  const { itens: catalogo } = useCatalogo(convenioId || null);
  React.useEffect(() => {
    const proc = catalogo.find(p => p.id === procedimentoId);
    if (proc && proc.valor != null) setValor(String(proc.valor));
  }, [catalogo, procedimentoId]);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!pacienteId) { setErro('Selecione um paciente.'); return; }
    if (!valor || Number(valor) <= 0) { setErro('Informe um valor válido.'); return; }
    setSalvando(true);
    try {
      // Sem comTimeout por fora: o serviço repete com a mesma operação e
      // nunca duplica (utils/operacaoCriacao).
      const novo = await cobrancasService.criar({
        pacienteId,
        procedimentoId: procedimentoId || null,
        medicoId: medicoId || null,
        convenioId: convenioId || null,
        descricao,
        valor: Number(valor),
        formaPagamento: formaPagamento || null,
      }, userId);
      onCriado(novo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0 }}>Nova cobrança</h3>
      <form onSubmit={salvar}>
        {erro && <p style={{ color: '#dc2626', fontSize: '16px' }}>{erro}</p>}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Paciente *</label>
          {pacienteSelecionado ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{pacienteSelecionado.nome}</span>
              <button type="button" onClick={() => { setPacienteId(''); setBusca(''); }} style={{ padding: '2px 8px', fontSize: '16px', cursor: 'pointer' }}>trocar</button>
            </div>
          ) : (
            <>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente por nome ou CPF..." style={{ width: '100%', padding: '8px' }} />
              {pacientesFiltrados.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', marginTop: '4px', maxHeight: '160px', overflow: 'auto' }}>
                  {pacientesFiltrados.map(p => (
                    <div key={p.id} onClick={() => { setPacienteId(p.id); setBusca(''); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '16px' }}>
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
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
            <select aria-label="Convênio" value={convenioId} onChange={e => setConvenioId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="">Particular</option>
              {convenios.filter(c => c.ativo && !c.particular).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Procedimento</label>
            <EscolhaProcedimento itens={catalogo} procedimentoId={procedimentoId} rotuloVazio="Selecione..." estilo={{ width: '100%', padding: '8px' }}
              onChange={id => setProcedimentoId(id || '')} />
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Valor (R$) *</label>
            <input type="number" min="0" step="0.01" required value={valor} onChange={e => setValor(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Profissional</label>
            <select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="">Não definido</option>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Forma de pagamento</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="">A definir</option>
              <option>Dinheiro</option>
              <option>Cartão de Débito</option>
              <option>Cartão de Crédito</option>
              <option>PIX</option>
              <option>Boleto</option>
              <option>Convênio</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 12px' }}>O repasse é calculado pela regra do profissional para o tipo do procedimento (Administração → Usuários).</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={salvando} style={{ padding: '10px 20px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvando...' : '✓ Lançar cobrança'}
          </button>
          <button type="button" onClick={onCancelar} style={{ padding: '10px 20px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

const PAGINA_COBRANCAS = 100;

export function FinanceiroPage({ pacientes }) {
  const toast = useToast();
  const { user, funcao } = useAuth();
  const podeGerenciar = FUNCOES_FINANCEIRO.includes(funcao);

  const hojeISO = dataLocalISO();
  const primeiroDiaMes = hojeISO.slice(0, 8) + '01';

  const [de, setDe] = React.useState(primeiroDiaMes);
  const [ate, setAte] = React.useState(hojeISO);
  const [cobrancas, setCobrancas] = React.useState([]);
  const [totalCobrancas, setTotalCobrancas] = React.useState(0);
  const [resumo, setResumo] = React.useState(null);
  // Falha nos totais é mostrada como tal (com nova tentativa) — nunca como
  // zero nem misturada com "sem movimentação".
  const [erroResumo, setErroResumo] = React.useState(false);
  const [carregandoMais, setCarregandoMais] = React.useState(false);
  const [procedimentos, setProcedimentos] = React.useState([]);
  const [convenios, setConvenios] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);

  // Lista em páginas de 100 e totais somados no banco: a soma não pode
  // depender de quantas cobranças a tela já carregou. O contador descarta
  // respostas de um filtro de datas que já mudou.
  const filtro = React.useMemo(
    () => (podeGerenciar ? { de, ate } : { de, ate, medicoId: user?.id }),
    [de, ate, podeGerenciar, user?.id]);
  const consultaAtual = React.useRef(0);

  const carregarResumo = React.useCallback(() => {
    const consulta = consultaAtual.current;
    setErroResumo(false);
    comTimeout(cobrancasService.resumo(filtro))
      .then(r => { if (consulta === consultaAtual.current) setResumo(r); })
      .catch(() => {
        if (consulta !== consultaAtual.current) return;
        setResumo(null);
        setErroResumo(true);
      });
  }, [filtro]);

  const carregar = React.useCallback(() => {
    const consulta = ++consultaAtual.current;
    setCarregando(true);
    setErro('');
    setResumo(null);
    carregarResumo();
    cobrancasService.listar({ ...filtro, limite: PAGINA_COBRANCAS })
      .then(({ itens, total }) => {
        if (consulta !== consultaAtual.current) return;
        setCobrancas(itens);
        setTotalCobrancas(total);
      })
      .catch(err => { if (consulta === consultaAtual.current) setErro(err.message || 'Erro ao carregar cobranças.'); })
      .finally(() => { if (consulta === consultaAtual.current) setCarregando(false); });
  }, [filtro, carregarResumo]);

  const carregarMais = () => {
    const consulta = consultaAtual.current;
    setCarregandoMais(true);
    cobrancasService.listar({ ...filtro, limite: PAGINA_COBRANCAS, offset: cobrancas.length })
      .then(({ itens, total }) => {
        if (consulta !== consultaAtual.current) return;
        setCobrancas(prev => [...prev, ...itens.filter(n => !prev.some(c => c.id === n.id))]);
        setTotalCobrancas(total);
      })
      .catch(err => toast.error('Não foi possível carregar mais cobranças: ' + err.message))
      .finally(() => setCarregandoMais(false));
  };

  React.useEffect(() => { carregar(); }, [carregar]);

  React.useEffect(() => {
    if (!podeGerenciar) return;
    Promise.all([procedimentosService.listar(), conveniosService.listar(), usuariosService.listar()])
      .then(([p, c, u]) => { setProcedimentos(p); setConvenios(c); setUsuarios(u); })
      .catch(() => toast.error('Não foi possível carregar os dados para cobrança. Recarregue a página antes de criar uma cobrança'));
  }, [podeGerenciar, toast]);

  // Todo profissional de saúde (não só Médico) tem produção e repasse.
  const medicos = usuarios.filter(u => u.ativo && (FUNCOES_CLINICAS.includes(u.funcao) || (u.funcao === 'Administrador' && u.papel_clinico_administrador)));
  const buscandoNomes = usePacientesPorIds(React.useMemo(() => cobrancas.map(c => c.pacienteId), [cobrancas]));
  const nomePaciente = (id) => pacientes.find(p => p.id === id)?.nome || (buscandoNomes ? '…' : '(paciente não encontrado)');
  const nomeMedico = (id) => usuarios.find(u => u.id === id)?.nome || '—';

  const [ajustandoCobranca, setAjustandoCobranca] = React.useState(null);
  const salvarAjusteCobranca = async (cobranca) => {
    const valor = Number(ajustandoCobranca.valor);
    if (!(valor > 0)) { toast.warning('Informe um valor maior que zero.'); return; }
    setProcessandoId(cobranca.id);
    try {
      const proc = procedimentos.find(p => p.id === ajustandoCobranca.procedimentoId);
      const atualizada = await comTimeout(cobrancasService.ajustar(cobranca.id, {
        valor,
        descricao: ajustandoCobranca.descricao || proc?.nome || '',
        procedimentoId: ajustandoCobranca.procedimentoId || null,
      }, cobranca.versao));
      setCobrancas(prev => prev.map(c => c.id === cobranca.id ? atualizada : c));
      setAjustandoCobranca(null);
      carregarResumo();
    } catch (err) {
      if (err.code === 'P4090') { toast.warning(err.message); carregar(); } else { toast.error('Erro ao ajustar a cobrança: ' + err.message); }
    } finally {
      setProcessandoId(null);
    }
  };

  const mudarStatus = async (cobranca, novoStatus) => {
    setProcessandoId(cobranca.id);
    try {
      const atualizada = await comTimeout(cobrancasService.atualizarStatus(cobranca.id, novoStatus, cobranca.versao));
      setCobrancas(prev => prev.map(c => c.id === cobranca.id ? atualizada : c));
      carregarResumo();
    } catch (err) {
      if (err.code === 'P4090') {
        toast.warning(err.message);
        carregar();
      } else {
        toast.error('Erro ao atualizar status: ' + err.message);
      }
    } finally {
      setProcessandoId(null);
    }
  };


  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar</Link>

      <h2 style={{ marginTop: '20px' }}>Financeiro</h2>
      {!podeGerenciar && <p style={{ color: '#666', fontSize: '16px', marginTop: '-8px' }}>Suas cobranças e repasses (somente leitura).</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Link to="/financeiro/producao" style={{ padding: '8px 12px', fontSize: '16px', textDecoration: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px' }}>📊 Relatório de produção</Link>
        <label style={{ fontSize: '16px' }}>De <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ padding: '6px' }} /></label>
        <label style={{ fontSize: '16px' }}>Até <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '6px' }} /></label>
        {podeGerenciar && (
          <>
            <Link to="/financeiro/config" style={{ padding: '8px 12px', fontSize: '16px', textDecoration: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px' }}>⚙️ Convênios e tabelas</Link>
            {!mostrarForm && (
              <button onClick={() => setMostrarForm(true)} style={{ marginLeft: 'auto', padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                + Nova cobrança
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ backgroundColor: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '16px', color: '#666' }}>Total no período</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{resumo ? formatarMoeda(resumo.total) : (erroResumo ? 'Indisponível' : '…')}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '16px', color: '#666' }}>{podeGerenciar ? 'Total repasses' : 'Seu repasse'}</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{resumo ? formatarMoeda(resumo.totalRepasse) : (erroResumo ? 'Indisponível' : '…')}</div>
        </div>
        {erroResumo && (
          <div role="alert" style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 14px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b' }}>
            <span>Não foi possível calcular os totais do período (conexão ou servidor). A lista abaixo pode estar correta; os totais não são zero, só não foram carregados.</span>
            <button type="button" onClick={carregarResumo} style={{ padding: '6px 12px', border: '1px solid #991b1b', borderRadius: '4px', background: 'white', color: '#991b1b', cursor: 'pointer' }}>
              Recarregar totais
            </button>
          </div>
        )}
      </div>

      {mostrarForm && podeGerenciar && (
        <NovaCobrancaForm
          pacientes={pacientes}
          convenios={convenios}
          medicos={medicos}
          userId={user?.id}
          onCancelar={() => setMostrarForm(false)}
          onCriado={(nova) => {
            setMostrarForm(false);
            if (nova.recuperado) toast.warning('Uma cobrança salva antes, sem confirmação na hora, já estava gravada e foi recuperada. Confira-a; se precisar de outra, crie de novo.');
            // Fora do período escolhido, a nova cobrança não entra na lista.
            if ((!de || nova.dataCobranca >= de) && (!ate || nova.dataCobranca <= ate) && !cobrancas.some(c => c.id === nova.id)) {
              setCobrancas(prev => [nova, ...prev]);
              setTotalCobrancas(t => t + 1);
            }
            carregarResumo();
          }}
        />
      )}

      {erro && <p style={{ color: '#dc2626' }}>{erro}</p>}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {carregando ? (
          <p style={{ padding: '20px', color: '#666' }}>Carregando...</p>
        ) : cobrancas.length === 0 ? (
          <p style={{ padding: '20px', color: '#666' }}>Nenhuma cobrança no período.</p>
        ) : (
          cobrancas.map(c => (
            <div key={c.id} style={{ borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong>{nomePaciente(c.pacienteId)}</strong> — {formatarMoeda(c.valor)}
                {c.agendamentoId && <span style={{ marginLeft: '8px', fontSize: '14px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#075985' }}>da agenda</span>}
                {c.status === 'Pendente' && !(Number(c.valor) > 0) && <span style={{ marginLeft: '8px', fontSize: '14px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#92400e' }}>valor a definir</span>}
                <div style={{ fontSize: '16px', color: '#666' }}>
                  {new Date(c.dataCobranca + 'T12:00:00').toLocaleDateString('pt-BR')} · {c.descricao || 'Sem descrição'} · {nomeMedico(c.medicoId)}
                  {podeGerenciar && c.valorRepasse > 0 && <> · repasse {formatarMoeda(c.valorRepasse)}</>}
                </div>
                {ajustandoCobranca?.id === c.id && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '260px', flex: 2 }}>
                      <EscolhaProcedimento itens={procedimentos.filter(p => p.ativo || p.id === ajustandoCobranca.procedimentoId).map(p => ({ ...p, valor: p.valorParticular }))}
                        procedimentoId={ajustandoCobranca.procedimentoId} rotuloVazio="Procedimento a definir" estilo={{ padding: '6px', width: '100%' }}
                        onChange={id => setAjustandoCobranca(a => ({ ...a, procedimentoId: id, descricao: procedimentos.find(p => p.id === id)?.nome || a.descricao }))} />
                    </div>
                    <input aria-label="Descrição" value={ajustandoCobranca.descricao} onChange={e => setAjustandoCobranca(a => ({ ...a, descricao: e.target.value }))} style={{ padding: '6px', minWidth: '200px' }} />
                    <input aria-label="Valor" type="number" min="0" step="0.01" value={ajustandoCobranca.valor} onChange={e => setAjustandoCobranca(a => ({ ...a, valor: e.target.value }))} style={{ padding: '6px', width: '120px' }} />
                    <button onClick={() => salvarAjusteCobranca(c)} disabled={processandoId === c.id}>Salvar</button>
                    <button onClick={() => setAjustandoCobranca(null)}>Cancelar</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: COBRANCA_STATUS_CORES[c.status] || '#6b7280', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                  {c.status}
                </span>
                {podeGerenciar && c.status === 'Pendente' && (
                  <>
                    {ajustandoCobranca?.id !== c.id && (
                      <button onClick={() => setAjustandoCobranca({ id: c.id, valor: String(c.valor ?? ''), descricao: c.descricao || '', procedimentoId: c.procedimentoId || null })} disabled={processandoId === c.id} style={{ padding: '5px 10px', fontSize: '16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Ajustar</button>
                    )}
                    <button onClick={() => mudarStatus(c, 'Pago')} disabled={processandoId === c.id || !(Number(c.valor) > 0)} title={Number(c.valor) > 0 ? '' : 'Defina o valor antes de marcar como pago'} style={{ padding: '5px 10px', fontSize: '16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === c.id ? 'not-allowed' : 'pointer' }}>Marcar pago</button>
                    <button onClick={() => mudarStatus(c, 'Cancelado')} disabled={processandoId === c.id} style={{ padding: '5px 10px', fontSize: '16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === c.id ? 'not-allowed' : 'pointer' }}>Cancelar</button>
                  </>
                )}
                {podeGerenciar && (
                  <Link to={`/financeiro/recibo/${c.id}`} style={{ padding: '5px 10px', fontSize: '16px', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                    🖨️ Recibo
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
        {!carregando && cobrancas.length > 0 && (
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '15px', color: '#666' }}>
            <span>Mostrando {cobrancas.length} de {totalCobrancas}</span>
            {cobrancas.length < totalCobrancas && (
              <button onClick={carregarMais} disabled={carregandoMais} style={{ padding: '6px 12px' }}>
                {carregandoMais ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImprimirReciboPage() {
  const { clinica } = useClinica();
  const { id } = useParams();
  const [paciente, setPaciente] = React.useState(null);
  const [cobranca, setCobranca] = React.useState(null);
  const [nomeMedico, setNomeMedico] = React.useState('');
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    cobrancasService.buscarPorId(id)
      .then(async (c) => {
        setCobranca(c);
        const p = await pacientesService.buscarPorId(c.pacienteId);
        setPaciente(p);
        if (c.medicoId) {
          const perfil = await usuariosService.buscarPerfil(c.medicoId);
          if (perfil) setNomeMedico(perfil.nome);
        }
      })
      .catch(err => setErro(err.message || 'Recibo não encontrado.'))
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  if (erro || !cobranca || !paciente) return <div style={{ padding: '40px' }}>{erro || 'Recibo não encontrado.'}</div>;

  const dataFormatada = new Date(cobranca.dataCobranca + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="no-print" style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => { registrarImpressao(paciente.id, 'Recibo'); window.print(); }} style={{ padding: '9px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🖨️ Imprimir
        </button>
        <Link to="/financeiro" style={{ padding: '9px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', textDecoration: 'none' }}>
          Voltar
        </Link>
      </div>

      <div className="doc-preview" style={{ maxWidth: '700px', margin: '20px auto', fontFamily: 'Arial, sans-serif', fontSize: '16px', lineHeight: '1.6' }}>
        <CabecalhoImpresso paciente={paciente} />

        <h2 style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '18px', margin: '0 0 24px', textTransform: 'uppercase' }}>Recibo</h2>

        <p>
          Recebi de <strong>{paciente.nome}</strong>{paciente.cpf ? ` (CPF ${paciente.cpf})` : ''} a quantia de{' '}
          <strong>{formatarMoeda(cobranca.valor)}</strong>
          {cobranca.descricao ? ` referente a ${cobranca.descricao}` : ''}
          {cobranca.convenioId ? ' (convênio)' : ' (particular)'}.
        </p>

        {cobranca.formaPagamento && <p><strong>Forma de pagamento:</strong> {cobranca.formaPagamento}</p>}
        {nomeMedico && <p><strong>Profissional responsável:</strong> {nomeMedico}</p>}

        <div style={{ marginTop: '40px', textAlign: 'right' }}>
          <p>{clinica.nome}, {dataFormatada}</p>
        </div>

        <RodapeImpresso />
      </div>
    </div>
  );
}

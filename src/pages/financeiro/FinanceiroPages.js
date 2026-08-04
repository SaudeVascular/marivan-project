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
import { FUNCOES_FINANCEIRO } from '../../constants/roles';

export function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CatalogoFinanceiroPage() {
  const toast = useToast();
  const [procedimentos, setProcedimentos] = React.useState([]);
  const [convenios, setConvenios] = React.useState([]);
  const [valores, setValores] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [novoProc, setNovoProc] = React.useState({ nome: '', valorParticular: '', percentualRepasse: '' });
  const [novoConvenio, setNovoConvenio] = React.useState('');
  const [convenioSelecionado, setConvenioSelecionado] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [editandoProc, setEditandoProc] = React.useState(null);
  const [editandoConvenio, setEditandoConvenio] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    Promise.all([procedimentosService.listar(), conveniosService.listar(), conveniosService.listarValores()])
      .then(([p, c, v]) => { setProcedimentos(p); setConvenios(c); setValores(v); })
      .catch(err => toast.error('Erro ao carregar: ' + err.message))
      .finally(() => setCarregando(false));
  }, [toast]);

  React.useEffect(() => { carregar(); }, [carregar]);

  const criarProcedimento = async (e) => {
    e.preventDefault();
    if (!novoProc.nome.trim() || novoProc.valorParticular === '') return;
    setSalvando(true);
    try {
      const criado = await comTimeout(procedimentosService.criar({
        nome: novoProc.nome.trim(),
        valorParticular: Number(novoProc.valorParticular),
        percentualRepasse: Number(novoProc.percentualRepasse) || 0,
      }));
      setProcedimentos(prev => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoProc({ nome: '', valorParticular: '', percentualRepasse: '' });
    } catch (err) {
      toast.error('Erro ao criar procedimento: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivoProcedimento = async (p) => {
    try {
      const atualizado = await comTimeout(procedimentosService.atualizar(p.id, { nome: p.nome, valorParticular: p.valorParticular, percentualRepasse: p.percentualRepasse, ativo: !p.ativo }));
      setProcedimentos(prev => prev.map(x => x.id === p.id ? atualizado : x));
    } catch (err) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  };

  const salvarEdicaoProcedimento = async () => {
    if (!editandoProc?.nome.trim() || editandoProc.valorParticular === '') return;
    setSalvando(true);
    try {
      const atual = procedimentos.find(p => p.id === editandoProc.id);
      const atualizado = await comTimeout(procedimentosService.atualizar(editandoProc.id, {
        nome: editandoProc.nome.trim(),
        valorParticular: Number(editandoProc.valorParticular),
        percentualRepasse: Number(editandoProc.percentualRepasse) || 0,
        ativo: atual?.ativo ?? true,
      }));
      setProcedimentos(prev => prev.map(p => p.id === atualizado.id ? atualizado : p).sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoProc(null);
    } catch (err) {
      toast.error('Erro ao salvar procedimento: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirProcedimento = async (p) => {
    if (!window.confirm(`Excluir definitivamente o procedimento "${p.nome}"?\n\nSó funciona se ele nunca foi usado em nenhuma cobrança — senão, desative-o em vez de excluir.`)) return;
    try {
      await comTimeout(procedimentosService.excluir(p.id));
      setProcedimentos(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const criarConvenio = async (e) => {
    e.preventDefault();
    if (!novoConvenio.trim()) return;
    setSalvando(true);
    try {
      const criado = await comTimeout(conveniosService.criar({ nome: novoConvenio.trim() }));
      setConvenios(prev => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoConvenio('');
    } catch (err) {
      toast.error('Erro ao criar convênio: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivoConvenio = async (c) => {
    try {
      const atualizado = await comTimeout(conveniosService.atualizar(c.id, { nome: c.nome, ativo: !c.ativo }));
      setConvenios(prev => prev.map(x => x.id === c.id ? atualizado : x));
    } catch (err) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  };

  const excluirConvenio = async (c) => {
    if (!window.confirm(`Excluir definitivamente o convênio "${c.nome}"?\n\nSó funciona se ele nunca foi usado em nenhuma cobrança — senão, desative-o em vez de excluir.`)) return;
    try {
      await comTimeout(conveniosService.excluir(c.id));
      setConvenios(prev => prev.filter(x => x.id !== c.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const salvarEdicaoConvenio = async () => {
    if (!editandoConvenio?.nome.trim()) return;
    setSalvando(true);
    try {
      const atual = convenios.find(c => c.id === editandoConvenio.id);
      const atualizado = await comTimeout(conveniosService.atualizar(editandoConvenio.id, {
        nome: editandoConvenio.nome.trim(),
        ativo: atual?.ativo ?? true,
      }));
      setConvenios(prev => prev.map(c => c.id === atualizado.id ? atualizado : c).sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoConvenio(null);
    } catch (err) {
      toast.error('Erro ao salvar convênio: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const valorOverride = (procedimentoId) =>
    valores.find(v => v.convenioId === convenioSelecionado && v.procedimentoId === procedimentoId);

  const salvarValorConvenio = async (procedimentoId, valorTexto) => {
    if (valorTexto === '') return;
    try {
      const salvo = await comTimeout(conveniosService.definirValor({
        convenioId: convenioSelecionado,
        procedimentoId,
        valor: Number(valorTexto),
      }));
      setValores(prev => [...prev.filter(v => !(v.convenioId === convenioSelecionado && v.procedimentoId === procedimentoId)), salvo]);
    } catch (err) {
      toast.error('Erro ao salvar valor: ' + err.message);
    }
  };

  if (carregando) return <div><Header /><p style={{ padding: '20px' }}>Carregando...</p></div>;

  return (
    <div>
      <Header />
      <Link to="/financeiro">← Voltar</Link>
      <h2 style={{ marginTop: '20px' }}>Procedimentos e Convênios</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Procedimentos */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Procedimentos</h3>
          <form onSubmit={criarProcedimento} style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <input placeholder="Nome" value={novoProc.nome} onChange={e => setNovoProc({ ...novoProc, nome: e.target.value })} style={{ flex: 2, minWidth: '140px', padding: '7px' }} />
            <input placeholder="Valor R$" type="number" min="0" step="0.01" value={novoProc.valorParticular} onChange={e => setNovoProc({ ...novoProc, valorParticular: e.target.value })} style={{ flex: 1, minWidth: '90px', padding: '7px' }} />
            <input placeholder="% repasse" type="number" min="0" max="100" step="0.1" value={novoProc.percentualRepasse} onChange={e => setNovoProc({ ...novoProc, percentualRepasse: e.target.value })} style={{ flex: 1, minWidth: '90px', padding: '7px' }} />
            <button type="submit" disabled={salvando} style={{ padding: '7px 14px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add</button>
          </form>
          {procedimentos.map(p => (
            <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', opacity: p.ativo ? 1 : 0.5 }}>
              {editandoProc?.id === p.id ? (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={editandoProc.nome} onChange={e => setEditandoProc({ ...editandoProc, nome: e.target.value })} style={{ flex: 2, minWidth: '120px', padding: '6px', fontSize: '13px' }} />
                  <input type="number" min="0" step="0.01" value={editandoProc.valorParticular} onChange={e => setEditandoProc({ ...editandoProc, valorParticular: e.target.value })} style={{ flex: 1, minWidth: '80px', padding: '6px', fontSize: '13px' }} />
                  <input type="number" min="0" max="100" step="0.1" value={editandoProc.percentualRepasse} onChange={e => setEditandoProc({ ...editandoProc, percentualRepasse: e.target.value })} style={{ flex: 1, minWidth: '80px', padding: '6px', fontSize: '13px' }} />
                  <button onClick={salvarEdicaoProcedimento} disabled={salvando} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: salvando ? '#9ca3af' : '#0369a1', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer' }}>✓</button>
                  <button onClick={() => setEditandoProc(null)} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{p.nome}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{formatarMoeda(p.valorParticular)} · {p.percentualRepasse}% repasse</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditandoProc({ id: p.id, nome: p.nome, valorParticular: p.valorParticular, percentualRepasse: p.percentualRepasse })} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => alternarAtivoProcedimento(p)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: p.ativo ? '#fee2e2' : '#d1fae5', color: p.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      {p.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button onClick={() => excluirProcedimento(p)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: 'white', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Convênios */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Convênios</h3>
          <form onSubmit={criarConvenio} style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <input placeholder="Nome do convênio" value={novoConvenio} onChange={e => setNovoConvenio(e.target.value)} style={{ flex: 1, padding: '7px' }} />
            <button type="submit" disabled={salvando} style={{ padding: '7px 14px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add</button>
          </form>

          {convenios.map(c => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', opacity: c.ativo ? 1 : 0.5 }}>
              {editandoConvenio?.id === c.id ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input value={editandoConvenio.nome} onChange={e => setEditandoConvenio({ ...editandoConvenio, nome: e.target.value })} style={{ flex: 1, padding: '6px', fontSize: '13px' }} />
                  <button onClick={salvarEdicaoConvenio} disabled={salvando} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: salvando ? '#9ca3af' : '#0369a1', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer' }}>✓</button>
                  <button onClick={() => setEditandoConvenio(null)} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{c.nome}</strong>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditandoConvenio({ id: c.id, nome: c.nome })} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => alternarAtivoConvenio(c)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: c.ativo ? '#fee2e2' : '#d1fae5', color: c.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      {c.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button onClick={() => excluirConvenio(c)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: 'white', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', margin: '14px 0 6px' }}>Valores por procedimento</label>
          <select value={convenioSelecionado} onChange={e => setConvenioSelecionado(e.target.value)} style={{ width: '100%', padding: '7px', marginBottom: '10px' }}>
            <option value="">Selecione um convênio...</option>
            {convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          {convenioSelecionado && procedimentos.filter(p => p.ativo).map(p => {
            const override = valorOverride(p.id);
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '13px' }}>{p.nome} <span style={{ color: '#999' }}>(particular: {formatarMoeda(p.valorParticular)})</span></span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="usa particular"
                  defaultValue={override ? override.valor : ''}
                  onBlur={e => salvarValorConvenio(p.id, e.target.value)}
                  style={{ width: '110px', padding: '5px', fontSize: '13px' }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const COBRANCA_STATUS_CORES = { 'Pendente': '#f59e0b', 'Pago': '#28a745', 'Cancelado': '#6c757d', 'Glosado': '#ef4444' };

export function NovaCobrancaForm({ pacientes, procedimentos, convenios, valoresConvenio, medicos, userId, onCriado, onCancelar }) {
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

  const pacientesFiltrados = busca.trim()
    ? pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.cpf || '').includes(busca)).slice(0, 8)
    : [];
  const pacienteSelecionado = pacientes.find(p => p.id === pacienteId);
  const procedimentoSelecionado = procedimentos.find(p => p.id === procedimentoId);

  const aplicarValorSugerido = (procId, convId) => {
    const proc = procedimentos.find(p => p.id === procId);
    if (!proc) return;
    if (convId) {
      const override = valoresConvenio.find(v => v.convenioId === convId && v.procedimentoId === procId);
      setValor(override ? String(override.valor) : String(proc.valorParticular));
    } else {
      setValor(String(proc.valorParticular));
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!pacienteId) { setErro('Selecione um paciente.'); return; }
    if (!valor || Number(valor) <= 0) { setErro('Informe um valor válido.'); return; }
    setSalvando(true);
    try {
      const novo = await comTimeout(cobrancasService.criar({
        pacienteId,
        procedimentoId: procedimentoId || null,
        medicoId: medicoId || null,
        convenioId: convenioId || null,
        descricao,
        valor: Number(valor),
        percentualRepasse: procedimentoSelecionado?.percentualRepasse || 0,
        formaPagamento: formaPagamento || null,
      }, userId));
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
        {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Paciente *</label>
          {pacienteSelecionado ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{pacienteSelecionado.nome}</span>
              <button type="button" onClick={() => { setPacienteId(''); setBusca(''); }} style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}>trocar</button>
            </div>
          ) : (
            <>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente por nome ou CPF..." style={{ width: '100%', padding: '8px' }} />
              {pacientesFiltrados.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', marginTop: '4px', maxHeight: '160px', overflow: 'auto' }}>
                  {pacientesFiltrados.map(p => (
                    <div key={p.id} onClick={() => { setPacienteId(p.id); setBusca(''); }} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '14px' }}>
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
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
            <select value={convenioId} onChange={e => { setConvenioId(e.target.value); aplicarValorSugerido(procedimentoId, e.target.value); }} style={{ width: '100%', padding: '8px' }}>
              <option value="">Particular</option>
              {convenios.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Procedimento</label>
            <select value={procedimentoId} onChange={e => { setProcedimentoId(e.target.value); aplicarValorSugerido(e.target.value, convenioId); }} style={{ width: '100%', padding: '8px' }}>
              <option value="">Selecione...</option>
              {procedimentos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Valor (R$) *</label>
            <input type="number" min="0" step="0.01" required value={valor} onChange={e => setValor(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Médico responsável</label>
            <select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="">Não definido</option>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Forma de pagamento</label>
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
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

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

export function FinanceiroPage({ pacientes }) {
  const toast = useToast();
  const { user, funcao } = useAuth();
  const podeGerenciar = FUNCOES_FINANCEIRO.includes(funcao);

  const hojeISO = new Date().toISOString().split('T')[0];
  const primeiroDiaMes = hojeISO.slice(0, 8) + '01';

  const [de, setDe] = React.useState(primeiroDiaMes);
  const [ate, setAte] = React.useState(hojeISO);
  const [cobrancas, setCobrancas] = React.useState([]);
  const [procedimentos, setProcedimentos] = React.useState([]);
  const [convenios, setConvenios] = React.useState([]);
  const [valoresConvenio, setValoresConvenio] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    const filtro = podeGerenciar ? { de, ate } : { de, ate, medicoId: user?.id };
    cobrancasService.listar(filtro)
      .then(setCobrancas)
      .catch(err => setErro(err.message || 'Erro ao carregar cobranças.'))
      .finally(() => setCarregando(false));
  }, [de, ate, podeGerenciar, user?.id]);

  React.useEffect(() => { carregar(); }, [carregar]);

  React.useEffect(() => {
    if (!podeGerenciar) return;
    Promise.all([procedimentosService.listar(), conveniosService.listar(), conveniosService.listarValores(), usuariosService.listar()])
      .then(([p, c, v, u]) => { setProcedimentos(p); setConvenios(c); setValoresConvenio(v); setUsuarios(u); })
      .catch(() => {});
  }, [podeGerenciar]);

  const medicos = usuarios.filter(u => u.ativo && u.funcao === 'Médico');
  const nomePaciente = (id) => pacientes.find(p => p.id === id)?.nome || '(paciente não encontrado)';
  const nomeMedico = (id) => usuarios.find(u => u.id === id)?.nome || '—';

  const mudarStatus = async (cobranca, novoStatus) => {
    setProcessandoId(cobranca.id);
    try {
      const atualizada = await comTimeout(cobrancasService.atualizarStatus(cobranca.id, novoStatus));
      setCobrancas(prev => prev.map(c => c.id === cobranca.id ? atualizada : c));
    } catch (err) {
      toast.error('Erro ao atualizar status: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const totalPeriodo = cobrancas.filter(c => c.status !== 'Cancelado').reduce((s, c) => s + Number(c.valor), 0);
  const totalRepasse = cobrancas.filter(c => c.status !== 'Cancelado').reduce((s, c) => s + Number(c.valorRepasse || 0), 0);

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar</Link>

      <h2 style={{ marginTop: '20px' }}>Financeiro</h2>
      {!podeGerenciar && <p style={{ color: '#666', fontSize: '14px', marginTop: '-8px' }}>Suas cobranças e repasses (somente leitura).</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '13px' }}>De <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ padding: '6px' }} /></label>
        <label style={{ fontSize: '13px' }}>Até <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '6px' }} /></label>
        {podeGerenciar && (
          <>
            <Link to="/financeiro/config" style={{ padding: '8px 12px', fontSize: '13px', textDecoration: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px' }}>⚙️ Procedimentos e Convênios</Link>
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
          <div style={{ fontSize: '12px', color: '#666' }}>Total no período</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatarMoeda(totalPeriodo)}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>{podeGerenciar ? 'Total repasses' : 'Seu repasse'}</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatarMoeda(totalRepasse)}</div>
        </div>
      </div>

      {mostrarForm && podeGerenciar && (
        <NovaCobrancaForm
          pacientes={pacientes}
          procedimentos={procedimentos}
          convenios={convenios}
          valoresConvenio={valoresConvenio}
          medicos={medicos}
          userId={user?.id}
          onCancelar={() => setMostrarForm(false)}
          onCriado={(nova) => { setMostrarForm(false); setCobrancas(prev => [nova, ...prev]); }}
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
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {new Date(c.dataCobranca + 'T12:00:00').toLocaleDateString('pt-BR')} · {c.descricao || 'Sem descrição'} · {nomeMedico(c.medicoId)}
                  {podeGerenciar && c.valorRepasse > 0 && <> · repasse {formatarMoeda(c.valorRepasse)}</>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: COBRANCA_STATUS_CORES[c.status] || '#6b7280', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  {c.status}
                </span>
                {podeGerenciar && c.status === 'Pendente' && (
                  <>
                    <button onClick={() => mudarStatus(c, 'Pago')} disabled={processandoId === c.id} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === c.id ? 'not-allowed' : 'pointer' }}>Marcar pago</button>
                    <button onClick={() => mudarStatus(c, 'Cancelado')} disabled={processandoId === c.id} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === c.id ? 'not-allowed' : 'pointer' }}>Cancelar</button>
                  </>
                )}
                {podeGerenciar && (
                  <Link to={`/financeiro/recibo/${c.id}`} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                    🖨️ Recibo
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
          const perfil = await usuariosService.buscarPerfil(c.medicoId).catch(() => null);
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
        <button onClick={() => window.print()} style={{ padding: '9px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          🖨️ Imprimir
        </button>
        <Link to="/financeiro" style={{ padding: '9px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', textDecoration: 'none' }}>
          Voltar
        </Link>
      </div>

      <div className="doc-preview" style={{ maxWidth: '700px', margin: '20px auto', fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
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

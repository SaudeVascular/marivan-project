import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { conveniosService } from '../../services/convenios.service';
import { procedimentosService, TIPOS_PROCEDIMENTO } from '../../services/procedimentos.service';
import { comTimeout } from '../../utils/comTimeout';
import { formatarMoeda } from '../../utils/formatters';
import { cnpjValido } from '../../utils/validacaoCadastro';
import { formatarCNPJ } from '../../utils/mascaras';
import { lerPlanilha, baixarPlanilha } from '../../utils/planilha';
import { UFS } from '../../constants/roles';
import { EscolhaProcedimento, rotuloProcedimento, SEM_AUTOPREENCHIMENTO } from '../agenda/SeletorProcedimento';

const cartao = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
const rotulo = { fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };
const campo = { width: '100%', padding: '8px', boxSizing: 'border-box' };
const botao = (cor = '#0369a1') => ({ padding: '8px 14px', backgroundColor: cor, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' });
const botaoClaro = { padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' };
const POR_PAGINA = 100;
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ConveniosTabelasPage() {
  const toast = useToast();
  const [aba, setAba] = React.useState('convenios');
  const [convenios, setConvenios] = React.useState([]);
  const [procedimentos, setProcedimentos] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [selecionadoId, setSelecionadoId] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    setErro('');
    return Promise.all([conveniosService.listar(), procedimentosService.listar()])
      .then(([c, p]) => { setConvenios(c); setProcedimentos(p); })
      .catch(err => setErro('Não foi possível carregar convênios e procedimentos: ' + err.message))
      .finally(() => setCarregando(false));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  const recarregarProcedimentos = React.useCallback(() =>
    procedimentosService.listar().then(setProcedimentos).catch(err => toast.error('Erro ao recarregar procedimentos: ' + err.message)), [toast]);

  const selecionado = convenios.find(c => c.id === selecionadoId) || null;

  return (
    <div>
      <Header />
      <Link to="/financeiro">← Voltar</Link>
      <h2 style={{ marginTop: '20px' }}>Convênios e tabelas</h2>
      <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[['convenios', 'Convênios'], ['procedimentos', 'Procedimentos']].map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            style={{ ...botaoClaro, ...(aba === id ? { backgroundColor: '#0369a1', color: 'white', borderColor: '#0369a1' } : {}) }}>
            {nome}
          </button>
        ))}
      </div>
      {erro && (
        <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '12px' }}>
          {erro} <button onClick={carregar} style={botaoClaro}>Tentar de novo</button>
        </div>
      )}
      {carregando ? <p>Carregando...</p> : aba === 'convenios' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 3fr', gap: '20px', alignItems: 'start' }} className="grade-convenios">
          <ListaConvenios convenios={convenios} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId}
            onCriado={(c) => { setConvenios(prev => [...prev, c].sort((a, b) => a.nome.localeCompare(b.nome))); setSelecionadoId(c.id); }} />
          {selecionado ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              <DadosOperadora key={selecionado.id} convenio={selecionado}
                onSalvo={(c) => setConvenios(prev => prev.map(x => x.id === c.id ? c : x).sort((a, b) => a.nome.localeCompare(b.nome)))}
                onExcluido={(id) => { setConvenios(prev => prev.filter(x => x.id !== id)); setSelecionadoId(null); }} />
              <TabelaConvenio key={'t' + selecionado.id} convenio={selecionado} procedimentos={procedimentos}
                onProcedimentosMudaram={recarregarProcedimentos} />
            </div>
          ) : (
            <div style={cartao}><p style={{ color: '#6b7280', margin: 0 }}>Escolha um convênio à esquerda, ou cadastre um novo.</p></div>
          )}
        </div>
      ) : (
        <CatalogoProcedimentos procedimentos={procedimentos} setProcedimentos={setProcedimentos} />
      )}
    </div>
  );
}

function ListaConvenios({ convenios, selecionadoId, onSelecionar, onCriado }) {
  const toast = useToast();
  const [nome, setNome] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const criar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      onCriado(await comTimeout(conveniosService.criar({ nome: nome.trim() })));
      setNome('');
    } catch (err) {
      toast.error('Erro ao criar convênio: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div style={cartao}>
      <h3 style={{ marginTop: 0 }}>Convênios</h3>
      <form onSubmit={criar} style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <input aria-label="Nome do novo convênio" placeholder="Nome do convênio" value={nome} onChange={e => setNome(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '7px' }} />
        <button type="submit" disabled={salvando} style={botao('#28a745')}>+ Novo</button>
      </form>
      {convenios.map(c => (
        <button key={c.id} onClick={() => onSelecionar(c.id)} aria-current={c.id === selecionadoId}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px', marginBottom: '4px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px',
            border: c.id === selecionadoId ? '2px solid #0369a1' : '1px solid #e5e7eb', backgroundColor: c.id === selecionadoId ? '#f0f9ff' : 'white', opacity: c.ativo ? 1 : 0.55 }}>
          <strong>{c.nome}</strong>
          {c.particular && <span style={{ marginLeft: '6px', fontSize: '14px', color: '#6b7280' }}>(tabela da clínica)</span>}
          {!c.ativo && <span style={{ marginLeft: '6px', fontSize: '14px', color: '#991b1b' }}>inativo</span>}
          {c.registroAns && <div style={{ fontSize: '14px', color: '#6b7280' }}>ANS {c.registroAns}</div>}
        </button>
      ))}
    </div>
  );
}

const CAMPOS_VAZIOS = {
  nome: '', razaoSocial: '', cnpj: '', registroAns: '', codigoPrestador: '', telefone: '', email: '', site: '',
  cep: '', endereco: '', cidade: '', uf: '', contato: '', prazoPagamentoDias: '', tabelaReferencia: '', observacoes: '',
};

function DadosOperadora({ convenio, onSalvo, onExcluido }) {
  const toast = useToast();
  const [form, setForm] = React.useState(() => {
    const f = { ...CAMPOS_VAZIOS };
    for (const k of Object.keys(f)) f[k] = convenio[k] ?? '';
    f.cnpj = formatarCNPJ(f.cnpj);
    return f;
  });
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const muda = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Informe o nome do convênio.'); return; }
    if (form.cnpj && !cnpjValido(form.cnpj)) { setErro('CNPJ inválido — confira os dígitos.'); return; }
    if (form.registroAns && !/^\d{6}$/.test(form.registroAns)) { setErro('O Registro ANS tem 6 dígitos.'); return; }
    if (form.cep && form.cep.replace(/\D/g, '').length !== 8) { setErro('O CEP tem 8 dígitos.'); return; }
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setErro('E-mail inválido.'); return; }
    if (form.prazoPagamentoDias !== '' && !(Number(form.prazoPagamentoDias) >= 0 && Number(form.prazoPagamentoDias) <= 365)) {
      setErro('Prazo de pagamento entre 0 e 365 dias.'); return;
    }
    setSalvando(true);
    try {
      const salvo = await comTimeout(conveniosService.atualizar(convenio.id, { ...form, nome: form.nome.trim() }));
      onSalvo(salvo);
      toast.success('Dados do convênio salvos.');
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async () => {
    try {
      onSalvo(await comTimeout(conveniosService.atualizar(convenio.id, { ativo: !convenio.ativo })));
    } catch (err) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir definitivamente o convênio "${convenio.nome}" e a tabela dele?\n\nSó funciona se ele nunca foi usado em nenhuma cobrança — senão, desative-o.`)) return;
    try {
      await comTimeout(conveniosService.excluir(convenio.id));
      onExcluido(convenio.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const linha = (k, nome, props = {}) => (
    <div>
      <label style={rotulo} htmlFor={`op-${k}`}>{nome}</label>
      <input id={`op-${k}`} value={form[k]} onChange={muda(k)} style={campo} {...props} />
    </div>
  );

  return (
    <form onSubmit={salvar} style={cartao}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>{convenio.particular ? 'Particular — tabela da clínica' : 'Dados da operadora'}</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={alternarAtivo} style={botaoClaro}>{convenio.ativo ? 'Desativar' : 'Reativar'}</button>
          {!convenio.particular && <button type="button" onClick={excluir} style={{ ...botaoClaro, color: '#991b1b', borderColor: '#fecaca' }}>Excluir</button>}
        </div>
      </div>
      {convenio.particular ? (
        <p style={{ color: '#6b7280' }}>Valores cobrados de quem não tem convênio. São o "valor particular" de cada procedimento.</p>
      ) : (
        <>
          <div className="form-grid-3col" style={{ marginTop: '14px' }}>
            {linha('nome', 'Nome do convênio *', { required: true, maxLength: 120 })}
            {linha('razaoSocial', 'Razão social da operadora', { maxLength: 200 })}
            <div>
              <label style={rotulo} htmlFor="op-cnpj">CNPJ</label>
              <input id="op-cnpj" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: formatarCNPJ(e.target.value) }))} placeholder="00.000.000/0000-00" style={campo} />
            </div>
            {linha('registroAns', 'Registro ANS', { inputMode: 'numeric', maxLength: 6, placeholder: '6 dígitos — sai na guia SP/SADT', onChange: e => setForm(f => ({ ...f, registroAns: e.target.value.replace(/\D/g, '').slice(0, 6) })) })}
            {linha('codigoPrestador', 'Código da clínica na operadora', { maxLength: 30, placeholder: 'Código do contratado' })}
            {linha('tabelaReferencia', 'Tabela de referência', { maxLength: 60, placeholder: 'Ex.: TUSS, CBHPM 5ª ed., própria', list: 'tabelas-referencia' })}
            {linha('telefone', 'Telefone', { maxLength: 40 })}
            {linha('email', 'E-mail', { type: 'email', maxLength: 200 })}
            {linha('site', 'Site / portal do prestador', { maxLength: 200 })}
            {linha('contato', 'Contato (nome e telefone)', { maxLength: 200 })}
            {linha('prazoPagamentoDias', 'Prazo de pagamento (dias)', { type: 'number', min: 0, max: 365 })}
            {linha('cep', 'CEP', { inputMode: 'numeric', maxLength: 9 })}
            {linha('endereco', 'Endereço', { maxLength: 300 })}
            {linha('cidade', 'Cidade', { maxLength: 100 })}
            <div>
              <label style={rotulo} htmlFor="op-uf">UF</label>
              <select id="op-uf" value={form.uf} onChange={muda('uf')} style={campo}>
                <option value="">—</option>
                {UFS.map(uf => <option key={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <datalist id="tabelas-referencia">
            {['TUSS', 'CBHPM 5ª edição', 'AMB 92', 'Brasíndice', 'Simpro', 'Própria'].map(t => <option key={t} value={t} />)}
          </datalist>
          <div style={{ marginTop: '10px' }}>
            <label style={rotulo} htmlFor="op-observacoes">Observações do contrato</label>
            <textarea id="op-observacoes" value={form.observacoes} onChange={muda('observacoes')} maxLength={2000} rows={3} style={campo} />
          </div>
          {erro && <p role="alert" style={{ color: '#dc2626' }}>{erro}</p>}
          <button type="submit" disabled={salvando} style={{ ...botao(), marginTop: '12px' }}>{salvando ? 'Salvando...' : '✓ Salvar dados'}</button>
        </>
      )}
    </form>
  );
}

// Tabela de procedimentos de um convênio (ou do Particular, que é o valor
// particular de cada procedimento).
function TabelaConvenio({ convenio, procedimentos, onProcedimentosMudaram }) {
  const toast = useToast();
  const [itens, setItens] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');
  const [mostrar, setMostrar] = React.useState(POR_PAGINA);
  const [editando, setEditando] = React.useState(null);
  const [novo, setNovo] = React.useState({ procedimentoId: null, valor: '' });
  const [importando, setImportando] = React.useState(false);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    setErro('');
    const pedido = convenio.particular
      ? procedimentosService.listar().then(lista => lista.filter(p => p.valorParticular != null)
          .map(p => ({ id: p.id, procedimentoId: p.id, codigo: p.codigo, nome: p.nome, tipo: p.tipo, valor: p.valorParticular, ativo: p.ativo })))
      : conveniosService.tabela(convenio.id);
    return pedido.then(setItens)
      .catch(err => setErro('Não foi possível carregar a tabela: ' + err.message))
      .finally(() => setCarregando(false));
  }, [convenio.id, convenio.particular]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const filtrados = React.useMemo(() => {
    const termo = semAcento(busca.trim());
    const codigo = busca.toUpperCase().replace(/[^0-9A-Z]/g, '');
    return !termo ? itens : itens.filter(i => semAcento(i.nome).includes(termo) || (codigo && i.codigo.startsWith(codigo)));
  }, [itens, busca]);

  const gravarValor = async (procedimentoId, valor) => {
    if (convenio.particular) {
      const p = procedimentos.find(x => x.id === procedimentoId);
      await comTimeout(procedimentosService.atualizar(procedimentoId, { ...p, valorParticular: valor }));
      await onProcedimentosMudaram();
    } else {
      await comTimeout(conveniosService.definirValor({ convenioId: convenio.id, procedimentoId, valor }));
    }
  };

  const salvarEdicao = async () => {
    const valor = Number(String(editando.valor).replace(',', '.'));
    if (!(valor >= 0) || editando.valor === '') { toast.warning('Informe um valor válido.'); return; }
    try {
      await gravarValor(editando.procedimentoId, valor);
      setItens(prev => prev.map(i => i.procedimentoId === editando.procedimentoId ? { ...i, valor } : i));
      setEditando(null);
    } catch (err) {
      toast.error('Erro ao salvar valor: ' + err.message);
    }
  };

  const remover = async (item) => {
    if (!window.confirm(`Tirar "${item.nome}" da tabela ${convenio.particular ? 'particular' : `do ${convenio.nome}`}?`)) return;
    try {
      if (convenio.particular) await gravarValor(item.procedimentoId, null);
      else await comTimeout(conveniosService.removerValor(item.id));
      setItens(prev => prev.filter(i => i.procedimentoId !== item.procedimentoId));
    } catch (err) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  const acrescentar = async (e) => {
    e.preventDefault();
    const valor = Number(String(novo.valor).replace(',', '.'));
    if (!novo.procedimentoId || novo.valor === '' || !(valor >= 0)) { toast.warning('Escolha o procedimento e informe o valor.'); return; }
    try {
      await gravarValor(novo.procedimentoId, valor);
      setNovo({ procedimentoId: null, valor: '' });
      await carregar();
    } catch (err) {
      toast.error('Erro ao acrescentar: ' + err.message);
    }
  };

  const exportar = () => baixarPlanilha(`tabela-${semAcento(convenio.nome).replace(/[^a-z0-9]+/g, '-')}.xlsx`,
    itens.map(i => [i.codigo, i.nome, i.valor, i.tipo]))
    .catch(err => toast.error('Não foi possível gerar a planilha: ' + err.message));

  const naTabela = new Set(itens.map(i => i.procedimentoId));
  const disponiveis = procedimentos.filter(p => p.ativo && !naTabela.has(p.id)).map(p => ({ ...p, valor: null }));

  return (
    <div style={cartao}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>Tabela de procedimentos {convenio.particular ? 'particular' : `— ${convenio.nome}`} ({itens.length})</h3>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setImportando(v => !v)} style={botao('#28a745')}>⬆ Importar planilha</button>
          <button onClick={exportar} disabled={itens.length === 0} style={botaoClaro}>⬇ Baixar tabela</button>
        </div>
      </div>

      {importando && (
        <ImportadorTabela convenio={convenio} temTabela={itens.length > 0}
          onCancelar={() => setImportando(false)}
          onImportado={async () => { setImportando(false); await Promise.all([carregar(), onProcedimentosMudaram()]); }} />
      )}

      <form onSubmit={acrescentar} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '8px', alignItems: 'end', margin: '14px 0' }}>
        <div>
          <label style={rotulo}>Acrescentar procedimento</label>
          <EscolhaProcedimento itens={disponiveis} procedimentoId={novo.procedimentoId} rotuloVazio="Escolha..." estilo={campo}
            onChange={id => setNovo(n => ({ ...n, procedimentoId: id }))} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-valor">Valor acordado (R$)</label>
          <input id="novo-valor" type="number" min="0" step="0.01" value={novo.valor} onChange={e => setNovo(n => ({ ...n, valor: e.target.value }))} style={campo} />
        </div>
        <button type="submit" style={botao()}>+ Acrescentar</button>
      </form>
      <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '-6px' }}>
        Procedimento que ainda não existe: cadastre na aba Procedimentos, ou venha na planilha (é criado na importação).
      </p>

      <input aria-label="Buscar na tabela" {...SEM_AUTOPREENCHIMENTO('busca-tabela-convenio-pep')} placeholder="Buscar na tabela por nome ou código" value={busca} onChange={e => { setBusca(e.target.value); setMostrar(POR_PAGINA); }} style={{ ...campo, marginBottom: '8px' }} />
      {erro && <p role="alert" style={{ color: '#dc2626' }}>{erro}</p>}
      {carregando ? <p>Carregando...</p> : filtrados.length === 0 ? (
        <p style={{ color: '#6b7280' }}>{itens.length === 0 ? 'Tabela vazia. Importe uma planilha ou acrescente procedimentos.' : 'Nada encontrado.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '6px' }}>Código</th><th style={{ padding: '6px' }}>Procedimento</th><th style={{ padding: '6px' }}>Tipo</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Valor</th><th />
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, mostrar).map(i => (
                <tr key={i.procedimentoId} style={{ borderBottom: '1px solid #f3f4f6', opacity: i.ativo ? 1 : 0.55 }}>
                  <td style={{ padding: '6px', fontFamily: 'monospace' }}>{i.codigo || '—'}</td>
                  <td style={{ padding: '6px' }}>{i.nome}{!i.ativo && ' (inativo)'}</td>
                  <td style={{ padding: '6px' }}>{i.tipo}</td>
                  <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {editando?.procedimentoId === i.procedimentoId ? (
                      <input aria-label={`Valor de ${i.nome}`} autoFocus type="number" min="0" step="0.01" value={editando.valor}
                        onChange={e => setEditando(ed => ({ ...ed, valor: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(); if (e.key === 'Escape') setEditando(null); }}
                        style={{ width: '110px', padding: '4px' }} />
                    ) : formatarMoeda(i.valor)}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {editando?.procedimentoId === i.procedimentoId ? (
                      <>
                        <button onClick={salvarEdicao} style={botaoClaro}>✓</button>{' '}
                        <button onClick={() => setEditando(null)} style={botaoClaro}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditando({ procedimentoId: i.procedimentoId, valor: String(i.valor) })} style={botaoClaro}>Editar</button>{' '}
                        <button onClick={() => remover(i)} style={{ ...botaoClaro, color: '#991b1b' }}>Tirar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > mostrar && (
            <button onClick={() => setMostrar(m => m + POR_PAGINA)} style={{ ...botaoClaro, marginTop: '8px' }}>
              Mostrar mais ({filtrados.length - mostrar} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Lê a planilha no navegador, mostra o que será gravado e os problemas
// de cada linha, e só então grava — de uma vez, no banco.
// Sem `convenio`: importa o catálogo de procedimentos (valor particular
// opcional; nada sai do catálogo — migração 51).
export function ImportadorTabela({ convenio, temTabela, onImportado, onCancelar }) {
  const catalogo = !convenio;
  const toast = useToast();
  const [lido, setLido] = React.useState(null);
  const [lendo, setLendo] = React.useState(false);
  const [substituir, setSubstituir] = React.useState(false);
  const [ignorarErros, setIgnorarErros] = React.useState(false);
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const ler = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    setLido(null);
    setIgnorarErros(false);
    if (arquivo.size > 10 * 1024 * 1024) { setErro('Arquivo maior que 10 MB.'); return; }
    setLendo(true);
    try {
      setLido({ nome: arquivo.name, ...(await lerPlanilha(arquivo, { exigeValor: !catalogo })) });
    } catch (err) {
      setErro('Não consegui ler o arquivo. Ele é uma planilha (.xls, .xlsx, .ods ou .csv)? ' + (err.message || ''));
    } finally {
      setLendo(false);
    }
  };

  const temErros = lido?.erros.length > 0;
  const pode = lido && lido.itens.length > 0 && (!temErros || (ignorarErros && !substituir));

  const importar = async () => {
    if (substituir && temTabela && !window.confirm(`Substituir a tabela ${convenio.particular ? 'particular' : `do ${convenio.nome}`}?\n\nO que não estiver no arquivo sai da tabela.`)) return;
    setGravando(true);
    setErro('');
    try {
      // Sem comTimeout: uma tabela grande leva mais que o tempo padrão, e a
      // gravação é tudo ou nada — repetir não duplica nada.
      let r;
      if (catalogo) {
        r = await procedimentosService.importar(lido.itens);
        toast.success(`Procedimentos importados: ${r.novos} novos, ${r.atualizados} atualizados.`);
      } else {
        r = await conveniosService.importarTabela(convenio.id, lido.itens, substituir);
        toast.success(`Tabela importada: ${r.gravados} valores gravados` +
          (r.procedimentosNovos ? `, ${r.procedimentosNovos} procedimentos novos` : '') +
          (r.removidos ? `, ${r.removidos} retirados` : '') + '.');
      }
      await onImportado(r);
    } catch (err) {
      setErro('A importação não foi gravada (nada mudou): ' + err.message);
    } finally {
      setGravando(false);
    }
  };

  const modelo = () => baixarPlanilha(catalogo ? 'modelo-procedimentos.xlsx' : 'modelo-tabela-convenio.xlsx', [
    ['10101012', 'Consulta em consultório (no horário normal ou preestabelecido)', 180, 'Consulta'],
    ['40304361', 'Hemograma com contagem de plaquetas ou frações', 12.5, 'Exame'],
    ['', 'Curativo simples', 40, 'Procedimento'],
  ]).catch(err => toast.error('Não foi possível gerar o modelo: ' + err.message));

  return (
    <div style={{ border: '1px dashed #0369a1', borderRadius: '8px', padding: '14px', marginTop: '14px', backgroundColor: '#f8fbff' }}>
      <p style={{ marginTop: 0 }}>
        {catalogo ? (
          <>A planilha precisa de um cabeçalho com as colunas <strong>Código</strong> e <strong>Descrição</strong> (a TUSS da ANS já vem assim){' '}
          e, se quiser, <strong>Tipo</strong> (Consulta, Exame ou Procedimento — sem ele, vem do código TUSS) e <strong>Valor</strong> (particular).
          Procedimento que já existe (mesmo código) é atualizado; nada é apagado.</>
        ) : (
          <>A planilha precisa de um cabeçalho com as colunas <strong>Código</strong>, <strong>Descrição</strong> e <strong>Valor</strong>{' '}
          (e, se quiser, <strong>Tipo</strong>: Consulta, Exame ou Procedimento — sem ele, o tipo vem do código TUSS).</>
        )}
        Vale .xls, .xlsx, .ods ou .csv; só a primeira aba é lida.{' '}
        <button type="button" onClick={modelo} style={{ ...botaoClaro, padding: '2px 8px' }}>Baixar modelo</button>
      </p>
      <input aria-label="Arquivo da tabela" type="file" accept=".xls,.xlsx,.ods,.csv" onChange={ler} disabled={lendo || gravando} />
      {lendo && <p>Lendo a planilha...</p>}
      {erro && <p role="alert" style={{ color: '#dc2626' }}>{erro}</p>}
      {lido && (
        <div style={{ marginTop: '12px' }}>
          <p><strong>{lido.nome}</strong>: {lido.itens.length} linhas prontas{temErros ? `, ${lido.erros.length} com problema` : ''}{lido.avisos.length ? `, ${lido.avisos.length} avisos` : ''}.</p>
          {temErros && (
            <div role="alert" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px' }}>
              <strong>Linhas com problema</strong> (corrija na planilha e escolha o arquivo de novo):
              <ul style={{ margin: '4px 0' }}>
                {lido.erros.slice(0, 20).map((e, k) => <li key={k}>{e.linha ? `Linha ${e.linha}: ` : ''}{e.motivo}</li>)}
              </ul>
              {lido.erros.length > 20 && <div>… e mais {lido.erros.length - 20}.</div>}
              {lido.itens.length > 0 && (
                <label style={{ display: 'block', marginTop: '6px' }}>
                  <input type="checkbox" checked={ignorarErros} onChange={e => setIgnorarErros(e.target.checked)} /> Importar só as {lido.itens.length} linhas certas {catalogo ? '' : ' (não vale para substituir a tabela)'}
                </label>
              )}
            </div>
          )}
          {lido.avisos.length > 0 && (
            <ul style={{ color: '#92400e', margin: '0 0 8px' }}>
              {lido.avisos.slice(0, 10).map((a, k) => <li key={k}>Linha {a.linha}: {a.motivo}</li>)}
            </ul>
          )}
          {lido.itens.length > 0 && (
            <div style={{ overflowX: 'auto', maxHeight: '260px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <thead><tr style={{ textAlign: 'left' }}><th style={{ padding: '4px 6px' }}>Código</th><th style={{ padding: '4px 6px' }}>Descrição</th><th style={{ padding: '4px 6px' }}>Tipo</th><th style={{ padding: '4px 6px', textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {lido.itens.slice(0, 50).map((i, k) => (
                    <tr key={k} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{i.codigo || '—'}</td>
                      <td style={{ padding: '4px 6px' }}>{i.descricao || '(nome do cadastro)'}</td>
                      <td style={{ padding: '4px 6px' }}>{i.tipo || 'pelo código'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>{i.valor == null ? '—' : formatarMoeda(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lido.itens.length > 50 && <div style={{ padding: '4px 6px', color: '#6b7280' }}>… e mais {lido.itens.length - 50} linhas.</div>}
            </div>
          )}
          {!catalogo && <fieldset style={{ border: 'none', padding: 0, margin: '10px 0' }}>
            <label style={{ display: 'block' }}>
              <input type="radio" name="modo-importacao" checked={!substituir} onChange={() => setSubstituir(false)} /> Acrescentar e atualizar: o que estiver no arquivo entra ou tem o valor atualizado; o resto da tabela fica como está
            </label>
            <label style={{ display: 'block' }}>
              <input type="radio" name="modo-importacao" checked={substituir} onChange={() => setSubstituir(true)} /> Substituir a tabela inteira: o que não estiver no arquivo sai da tabela
            </label>
          </fieldset>}
          <div style={{ display: 'flex', gap: '8px', marginTop: catalogo ? '10px' : 0 }}>
            <button onClick={importar} disabled={!pode || gravando} style={{ ...botao('#28a745'), opacity: !pode || gravando ? 0.6 : 1 }}>
              {gravando ? 'Gravando...' : `Importar ${lido.itens.length} linhas`}
            </button>
            <button onClick={onCancelar} disabled={gravando} style={botaoClaro}>Cancelar</button>
          </div>
        </div>
      )}
      {!lido && <div style={{ marginTop: '8px' }}><button onClick={onCancelar} style={botaoClaro}>Cancelar</button></div>}
    </div>
  );
}

function CatalogoProcedimentos({ procedimentos, setProcedimentos }) {
  const toast = useToast();
  const [importando, setImportando] = React.useState(false);
  const [cadastrando, setCadastrando] = React.useState(false);
  const [filtroTipo, setFiltroTipo] = React.useState('');
  const vazio = { codigo: '', nome: '', tipo: 'Consulta', valorParticular: '' };
  const [novo, setNovo] = React.useState(vazio);
  const [editando, setEditando] = React.useState(null);
  const [busca, setBusca] = React.useState('');
  const [mostrar, setMostrar] = React.useState(POR_PAGINA);
  const [salvando, setSalvando] = React.useState(false);

  const ordenar = (lista) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome));
  const validar = (p) => {
    if (!p.nome.trim()) return 'Informe o nome.';
    if (p.codigo && p.codigo.toUpperCase().replace(/[^0-9A-Z]/g, '').length > 20) return 'Código com mais de 20 caracteres.';
    if (p.valorParticular !== '' && p.valorParticular != null && !(Number(p.valorParticular) >= 0)) return 'Valor particular inválido.';
    return null;
  };
  const mensagemErro = (err) => (err.code === '23505' ? 'Já existe um procedimento com este código.' : err.message);

  const criar = async (e) => {
    e.preventDefault();
    const problema = validar(novo);
    if (problema) { toast.warning(problema); return; }
    setSalvando(true);
    try {
      const criado = await comTimeout(procedimentosService.criar({ ...novo, nome: novo.nome.trim() }));
      setProcedimentos(prev => ordenar([...prev, criado]));
      setNovo(vazio);
    } catch (err) {
      toast.error('Erro ao criar procedimento: ' + mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async () => {
    const problema = validar(editando);
    if (problema) { toast.warning(problema); return; }
    setSalvando(true);
    try {
      const atual = procedimentos.find(p => p.id === editando.id);
      const salvo = await comTimeout(procedimentosService.atualizar(editando.id, { ...editando, nome: editando.nome.trim(), ativo: atual?.ativo ?? true }));
      setProcedimentos(prev => ordenar(prev.map(p => p.id === salvo.id ? salvo : p)));
      setEditando(null);
    } catch (err) {
      toast.error('Erro ao salvar: ' + mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (p) => {
    try {
      const salvo = await comTimeout(procedimentosService.atualizar(p.id, { ...p, ativo: !p.ativo }));
      setProcedimentos(prev => prev.map(x => x.id === p.id ? salvo : x));
    } catch (err) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  };

  const excluir = async (p) => {
    if (!window.confirm(`Excluir definitivamente o procedimento "${p.nome}"?\n\nSó funciona se ele nunca foi usado em nenhuma cobrança — senão, desative-o.`)) return;
    try {
      await comTimeout(procedimentosService.excluir(p.id));
      setProcedimentos(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Palavras em qualquer ordem ("vitamina d dosagem"), ou o começo do
  // código ("40305" ou "4.03.05").
  const filtrados = React.useMemo(() => {
    const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
    const codigo = busca.toUpperCase().replace(/[^0-9A-Z]/g, '');
    return procedimentos.filter(p =>
      (!filtroTipo || p.tipo === filtroTipo)
      && (palavras.length === 0
        || palavras.every(w => semAcento(p.nome).includes(w))
        || (/\d/.test(codigo) && p.codigo.startsWith(codigo))));
  }, [procedimentos, busca, filtroTipo]);

  const camposEdicao = (p, set) => (
    <>
      <input aria-label="Código" placeholder="Código (TUSS)" value={p.codigo} onChange={e => set({ ...p, codigo: e.target.value })} style={{ ...campo, width: '130px' }} />
      <input aria-label="Nome do procedimento" placeholder="Nome" value={p.nome} onChange={e => set({ ...p, nome: e.target.value })} style={{ ...campo, flex: 3, minWidth: '180px', width: 'auto' }} />
      <select aria-label="Tipo" value={p.tipo} onChange={e => set({ ...p, tipo: e.target.value })} style={{ ...campo, width: '150px' }}>
        {TIPOS_PROCEDIMENTO.map(t => <option key={t}>{t}</option>)}
      </select>
      <input aria-label="Valor particular" placeholder="Particular R$" type="number" min="0" step="0.01" value={p.valorParticular ?? ''} onChange={e => set({ ...p, valorParticular: e.target.value })} style={{ ...campo, width: '130px' }} />
    </>
  );

  return (
    <div style={cartao}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>Procedimentos ({procedimentos.length})</h3>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setImportando(v => !v)} style={botao('#28a745')}>⬆ Importar planilha de procedimentos</button>
          <button onClick={() => baixarPlanilha('procedimentos.xlsx', procedimentos.map(p => [p.codigo, p.nome, p.valorParticular ?? '', p.tipo]))
            .catch(err => toast.error('Não foi possível gerar a planilha: ' + err.message))} disabled={procedimentos.length === 0} style={botaoClaro}>⬇ Baixar catálogo</button>
        </div>
      </div>
      {importando && (
        <ImportadorTabela onCancelar={() => setImportando(false)}
          onImportado={async () => {
            setImportando(false);
            setProcedimentos(await procedimentosService.listar());
          }} />
      )}
      <p style={{ color: '#6b7280' }}>
        O <strong>tipo</strong> decide o percentual de repasse de cada profissional (Administração → Usuários).
        Os valores de cada convênio ficam na tabela do convênio.
      </p>
      <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
        <label htmlFor="pesquisa-procedimentos" style={{ ...rotulo, marginBottom: '6px' }}>🔍 Pesquisar procedimentos cadastrados</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input id="pesquisa-procedimentos" type="search" {...SEM_AUTOPREENCHIMENTO('busca-catalogo-procedimentos-pep')}
            placeholder="Nome (palavras em qualquer ordem) ou código TUSS" value={busca}
            onChange={e => { setBusca(e.target.value); setMostrar(POR_PAGINA); }}
            style={{ ...campo, flex: 1, minWidth: '220px', width: 'auto', fontSize: '16px', border: '2px solid #0369a1', borderRadius: '6px' }} />
          <select aria-label="Filtrar por tipo" value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setMostrar(POR_PAGINA); }} style={{ ...campo, width: '190px' }}>
            <option value="">Todos os tipos</option>
            {TIPOS_PROCEDIMENTO.map(t => <option key={t}>{t}</option>)}
          </select>
          {(busca || filtroTipo) && (
            <button type="button" onClick={() => { setBusca(''); setFiltroTipo(''); setMostrar(POR_PAGINA); }} style={botaoClaro}>Limpar</button>
          )}
        </div>
        <div role="status" style={{ fontSize: '15px', color: '#075985', marginTop: '6px' }}>
          {busca || filtroTipo ? `${filtrados.length} de ${procedimentos.length} procedimentos` : `${procedimentos.length} procedimentos cadastrados`}
        </div>
      </div>

      {cadastrando ? (
        <form onSubmit={criar} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {camposEdicao(novo, setNovo)}
          <button type="submit" disabled={salvando} style={botao('#28a745')}>+ Cadastrar</button>
          <button type="button" onClick={() => { setCadastrando(false); setNovo(vazio); }} style={botaoClaro}>Fechar</button>
        </form>
      ) : (
        <button type="button" onClick={() => setCadastrando(true)} style={{ ...botaoClaro, marginBottom: '14px' }}>+ Novo procedimento</button>
      )}
      {filtrados.length === 0 && (busca || filtroTipo) && (
        <p style={{ color: '#6b7280' }}>Nenhum procedimento encontrado.</p>
      )}
      {filtrados.slice(0, mostrar).map(p => (
        <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', opacity: p.ativo ? 1 : 0.5 }}>
          {editando?.id === p.id ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {camposEdicao(editando, setEditando)}
              <button onClick={salvarEdicao} disabled={salvando} style={botao()}>✓</button>
              <button onClick={() => setEditando(null)} style={botaoClaro}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <strong>{rotuloProcedimento(p)}</strong>
                <div style={{ fontSize: '16px', color: '#666' }}>
                  {p.tipo} · particular {p.valorParticular == null ? 'sem valor' : formatarMoeda(p.valorParticular)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEditando({ ...p, valorParticular: p.valorParticular ?? '' })} style={botaoClaro}>Editar</button>
                <button onClick={() => alternarAtivo(p)} style={botaoClaro}>{p.ativo ? 'Desativar' : 'Reativar'}</button>
                <button onClick={() => excluir(p)} style={{ ...botaoClaro, color: '#991b1b' }}>Excluir</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {filtrados.length > mostrar && (
        <button onClick={() => setMostrar(m => m + POR_PAGINA)} style={{ ...botaoClaro, marginTop: '8px' }}>
          Mostrar mais ({filtrados.length - mostrar} restantes)
        </button>
      )}
    </div>
  );
}

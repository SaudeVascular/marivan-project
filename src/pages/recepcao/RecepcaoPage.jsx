import { dataLocalISO } from '../../utils/formatters';
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { FUNCOES_CLINICAS } from '../../constants/roles';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { agendamentosService } from '../../services/agendamentos.service';
import { cobrancasService } from '../../services/cobrancas.service';
import { formatarMoeda } from '../../utils/formatters';
import { descontoEmReais, textoDesconto, FORMAS_PAGAMENTO } from '../financeiro/valores';
import { usuariosService } from '../../services/usuarios.service';
import { comTimeout } from '../../utils/comTimeout';
import { usePacientesPorIds } from '../../hooks/usePacientesCache';
import { STATUS_CORES, PROXIMOS_STATUS, NovoAgendamentoForm } from '../agenda/AgendaPages';
import { SeletorProcedimento, useCatalogo, useConvenios } from '../agenda/SeletorProcedimento';

// Mesma agenda que AgendaPage, mas recortada para o fluxo de check-in da
// recepção: telefone/convênio à mão para ligar, sem o botão "Atender"
// (que não é tarefa dela) e sem exigir passar pela Agenda genérica.
export function RecepcaoPage({ pacientes }) {
  const toast = useToast();
  const { user } = useAuth();

  const hojeISO = dataLocalISO();
  const [dataSelecionada, setDataSelecionada] = React.useState(hojeISO);
  const [agendamentos, setAgendamentos] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);
  const [ajustando, setAjustando] = React.useState(null); // { id, convenioId, procedimentoId }
  const convenios = useConvenios();
  const { itens: catalogo } = useCatalogo(null);
  // Procedimento e convênio do agendamento — viram a cobrança ao concluir.
  const rotuloCobranca = (ag) => `${catalogo.find(p => p.id === ag.procedimentoId)?.nome || 'Procedimento a definir'} · ${convenios.find(c => c.id === ag.convenioId)?.nome || 'Particular'}`;

  // O que já foi recebido em cada agendamento do dia (migração 54).
  const [pagamentos, setPagamentos] = React.useState({});
  const [erroPagamentos, setErroPagamentos] = React.useState(false);
  const [recebendo, setRecebendo] = React.useState(null); // { id, desconto, tipoDesconto, forma }

  const carregar = React.useCallback(() => {
    setCarregando(true);
    agendamentosService.listarPorData(dataSelecionada)
      .then(setAgendamentos)
      .catch(err => setErro(err.message || 'Erro ao carregar agenda.'))
      .finally(() => setCarregando(false));
    setErroPagamentos(false);
    cobrancasService.pagamentosDoDia(dataSelecionada)
      .then(lista => setPagamentos(Object.fromEntries(lista.map(p => [p.agendamentoId, p]))))
      .catch(() => { setPagamentos({}); setErroPagamentos(true); });
  }, [dataSelecionada]);

  // Particular: sem convênio, ou o convênio "Particular". Convênio quem
  // paga é a operadora — a Recepção não recebe.
  const ehParticular = (ag) => !ag.convenioId || !!convenios.find(c => c.id === ag.convenioId)?.particular;
  const valorTabela = (ag) => catalogo.find(p => p.id === ag.procedimentoId)?.valor ?? null;

  const confirmarRecebimento = async (ag) => {
    const valor = valorTabela(ag);
    const desconto = descontoEmReais(valor, recebendo.desconto, recebendo.tipoDesconto);
    if (!recebendo.forma) { toast.warning('Escolha a forma de pagamento.'); return; }
    setProcessandoId(ag.id);
    try {
      const r = await comTimeout(cobrancasService.receber(ag.id, { desconto, formaPagamento: recebendo.forma }));
      setPagamentos(prev => ({ ...prev, [ag.id]: { agendamentoId: ag.id, cobrancaId: r.cobrancaId, status: 'Pago', valor: r.valor, desconto: r.desconto, formaPagamento: r.formaPagamento } }));
      setRecebendo(null);
      toast.success(`Recebido ${formatarMoeda(r.valorPago)} (${r.formaPagamento}).`);
    } catch (err) {
      toast.error('Não foi possível registrar o pagamento: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  React.useEffect(() => { carregar(); }, [carregar]);

  React.useEffect(() => {
    usuariosService.listar().then(setUsuarios).catch(() => toast.error('Não foi possível carregar os profissionais. Recarregue a página para tentar novamente.'));
  }, [toast]);

  const profissionais = usuarios.filter(u => u.ativo && FUNCOES_CLINICAS.includes(u.funcao));

  usePacientesPorIds(React.useMemo(() => agendamentos.map(a => a.pacienteId), [agendamentos]));
  const pacientePor = (id) => pacientes.find(p => p.id === id);
  const nomeProfissional = (id) => usuarios.find(u => u.id === id)?.nome || '—';

  const salvarAjuste = async (ag) => {
    setProcessandoId(ag.id);
    try {
      const atualizado = await comTimeout(agendamentosService.ajustarProcedimento(ag.id, ajustando, ag.versao));
      setAgendamentos(prev => prev.map(a => a.id === ag.id ? atualizado : a));
      setAjustando(null);
    } catch (err) {
      if (err.code === 'P4090') { toast.warning(err.message); carregar(); } else { toast.error('Erro ao ajustar o procedimento: ' + err.message); }
    } finally {
      setProcessandoId(null);
    }
  };

  const mudarStatus = async (ag, novoStatus) => {
    setProcessandoId(ag.id);
    try {
      const atualizado = await comTimeout(agendamentosService.atualizarStatus(ag.id, novoStatus, ag.versao));
      setAgendamentos(prev => prev.map(a => a.id === ag.id ? atualizado : a));
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

  const mudarDia = (delta) => {
    const d = new Date(dataSelecionada + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDataSelecionada(dataLocalISO(d));
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
            if (novo.recuperado) toast.warning('Um agendamento salvo antes, sem confirmação na hora, já estava gravado e foi recuperado. Confira-o; se precisar de outro, crie de novo.');
            if (novo.data === dataSelecionada) {
              setAgendamentos(prev => [...prev.filter(a => a.id !== novo.id), novo].sort((a, b) => a.hora.localeCompare(b.hora)));
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
                  <div style={{ fontSize: '16px', color: '#666' }}>
                    {nomeProfissional(ag.medicoId)} · {ag.duracaoMin} min
                    {ag.observacoes && <> · {ag.observacoes}</>}
                  </div>
                  <div style={{ fontSize: '15px', color: '#555' }}>
                    {rotuloCobranca(ag)}
                    {['Agendado', 'Confirmado', 'Aguardando', 'Em atendimento'].includes(ag.status) && ajustando?.id !== ag.id && (
                      <button type="button" onClick={() => setAjustando({ id: ag.id, convenioId: ag.convenioId, procedimentoId: ag.procedimentoId })}
                        style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '15px', cursor: 'pointer' }}>
                        Confirmar/ajustar procedimento
                      </button>
                    )}
                  </div>
                  {ajustando?.id === ag.id && (
                    <div style={{ marginTop: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', maxWidth: '640px' }}>
                      <SeletorProcedimento convenios={convenios} convenioId={ajustando.convenioId} procedimentoId={ajustando.procedimentoId}
                        onChange={v => setAjustando(a => ({ ...a, ...v }))} />
                      <button type="button" onClick={() => salvarAjuste(ag)} disabled={processandoId === ag.id} style={{ padding: '6px 14px', marginRight: '8px', cursor: 'pointer' }}>
                        {processandoId === ag.id ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setAjustando(null)} style={{ padding: '6px 14px', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  )}
                  {ehParticular(ag) && !['Cancelado', 'Faltou'].includes(ag.status) && (() => {
                    const pag = pagamentos[ag.id];
                    if (pag?.status === 'Pago') {
                      return (
                        <div style={{ marginTop: '4px', fontSize: '15px', color: '#065f46' }}>
                          ✓ Recebido {formatarMoeda(pag.valor - pag.desconto)}
                          {pag.desconto > 0 && <> (desconto {textoDesconto(pag.desconto, pag.valor)})</>}
                          {pag.formaPagamento && <> · {pag.formaPagamento}</>}
                        </div>
                      );
                    }
                    const valor = valorTabela(ag);
                    if (recebendo?.id !== ag.id) {
                      return (
                        <div style={{ marginTop: '4px' }}>
                          <button type="button" disabled={erroPagamentos || processandoId === ag.id}
                            onClick={() => setRecebendo({ id: ag.id, desconto: '', tipoDesconto: 'R$', forma: '' })}
                            style={{ padding: '4px 12px', fontSize: '15px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            💵 Receber
                          </button>
                          {erroPagamentos && <span style={{ marginLeft: '6px', fontSize: '14px', color: '#991b1b' }}>não foi possível ver o que já foi recebido — recarregue</span>}
                        </div>
                      );
                    }
                    if (!ag.procedimentoId || !(valor > 0)) {
                      return (
                        <div style={{ marginTop: '6px', padding: '8px', border: '1px solid #fde68a', backgroundColor: '#fffbeb', borderRadius: '6px', fontSize: '15px' }}>
                          Defina o procedimento (com valor particular na tabela) antes de receber — "Confirmar/ajustar procedimento".{' '}
                          <button type="button" onClick={() => setRecebendo(null)} style={{ padding: '2px 8px' }}>Fechar</button>
                        </div>
                      );
                    }
                    const desconto = descontoEmReais(valor, recebendo.desconto, recebendo.tipoDesconto);
                    return (
                      <div style={{ marginTop: '6px', padding: '10px', border: '1px solid #6ee7b7', backgroundColor: '#f0fdf4', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '760px' }}>
                        <span>Valor da tabela: <strong>{formatarMoeda(valor)}</strong></span>
                        <label>Desconto <input aria-label="Desconto" type="number" min="0" step="0.01" value={recebendo.desconto}
                          onChange={e => setRecebendo(r => ({ ...r, desconto: e.target.value }))} style={{ width: '90px', padding: '5px' }} /></label>
                        <select aria-label="Tipo do desconto" value={recebendo.tipoDesconto} onChange={e => setRecebendo(r => ({ ...r, tipoDesconto: e.target.value }))} style={{ padding: '5px' }}>
                          <option>R$</option><option>%</option>
                        </select>
                        <strong>A pagar: {formatarMoeda(valor - desconto)}</strong>
                        <select aria-label="Forma de pagamento" value={recebendo.forma} onChange={e => setRecebendo(r => ({ ...r, forma: e.target.value }))} style={{ padding: '5px' }}>
                          <option value="">Forma de pagamento...</option>
                          {FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}
                        </select>
                        <button type="button" onClick={() => confirmarRecebimento(ag)} disabled={processandoId === ag.id}
                          style={{ padding: '6px 14px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                          {processandoId === ag.id ? 'Registrando...' : 'Confirmar recebimento'}
                        </button>
                        <button type="button" onClick={() => setRecebendo(null)} style={{ padding: '6px 10px' }}>Fechar</button>
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: '16px', color: '#444', marginTop: '2px' }}>
                    {paciente?.telefone
                      ? <a href={`tel:${paciente.telefone.replace(/\D/g, '')}`} style={{ color: '#0369a1', textDecoration: 'none' }}>📞 {paciente.telefone}</a>
                      : <span>📞 sem telefone cadastrado</span>}
                    {paciente?.convenio && <> · {paciente.convenio}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: STATUS_CORES[ag.status] || '#6b7280', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                    {ag.status}
                  </span>
                  {(PROXIMOS_STATUS[ag.status] || []).map(s => (
                    <button
                      key={s}
                      onClick={() => mudarStatus(ag, s)}
                      disabled={processandoId === ag.id}
                      style={{ padding: '5px 10px', fontSize: '16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: processandoId === ag.id ? 'not-allowed' : 'pointer', opacity: processandoId === ag.id ? 0.5 : 1 }}
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

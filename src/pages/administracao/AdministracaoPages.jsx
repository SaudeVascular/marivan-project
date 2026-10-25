import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { usuariosService } from '../../services/usuarios.service';
import { auditoriaService } from '../../services/auditoria.service';
import { acessosService } from '../../services/acessos.service';
import { baixarJson, exportacaoService, nomeArquivoExportacao } from '../../services/exportacao.service';
import { configuracoesService } from '../../services/configuracoes.service';
import { filiaisService } from '../../services/filiais.service';
import { examesService } from '../../services/exames.service';
import { repasseService } from '../../services/repasse.service';
import { pontuarCorrespondencia } from '../../utils/buscaExames';
import { comTimeout } from '../../utils/comTimeout';
import { formatarCPF, formatarCNPJ } from '../../utils/mascaras';
import { UFS, FUNCOES_USUARIO, CONSELHO_POR_FUNCAO, FUNCOES_CLINICAS } from '../../constants/roles';

// Painel administrativo (seção 2.5 do Documento Mestre) — hub com acesso
// a Usuários, Auditoria e Configurações da Clínica, no lugar de três
// links soltos no cabeçalho.
export function PainelAdministrativoPage() {
  const cardStyle = {
    display: 'block',
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    textDecoration: 'none',
    color: 'inherit',
  };

  return (
    <div>
      <Header />
      <Link to="/pacientes">← Voltar</Link>

      <h2 style={{ marginTop: '20px' }}>Painel Administrativo</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
        <Link to="/usuarios" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
          <h3 style={{ margin: '0 0 6px' }}>Usuários</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Criar contas, definir função e bloquear acesso.</p>
        </Link>
        <Link to="/auditoria" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🕵️</div>
          <h3 style={{ margin: '0 0 6px' }}>Auditoria</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Histórico de criação, alteração e exclusão no banco.</p>
        </Link>
        <Link to="/configuracoes" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏥</div>
          <h3 style={{ margin: '0 0 6px' }}>Configurações da Clínica</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Nome, endereço e telefone usados nos documentos impressos.</p>
        </Link>
        <Link to="/filiais" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏢</div>
          <h3 style={{ margin: '0 0 6px' }}>Filiais</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Cadastro de outras unidades, cada uma com sua própria logomarca.</p>
        </Link>
        <Link to="/financeiro/config" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>💳</div>
          <h3 style={{ margin: '0 0 6px' }}>Convênios e Procedimentos</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Cadastro de convênios, procedimentos e valores praticados por cada um.</p>
        </Link>
        <Link to="/catalogo-exames" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧪</div>
          <h3 style={{ margin: '0 0 6px' }}>Catálogo de Exames</h3>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Exames laboratoriais e de imagem, com código TUSS, usados na busca do Pedido de Exames.</p>
        </Link>
      </div>
      <ExportarClinica />
    </div>
  );
}

// Entrega dos dados ao cliente (migração 48): pacientes com o prontuário
// completo, agenda, cobranças, catálogos, clínica e profissionais, em JSON.
// Só Administrador com papel clínico concedido (contém dados clínicos).
function ExportarClinica() {
  const { perfil } = useAuth();
  const toast = useToast();
  const [progresso, setProgresso] = React.useState(null);
  const podeExportar = Boolean(perfil?.papel_clinico_administrador);
  const exportar = async () => {
    setProgresso({ feitos: 0, total: null });
    try {
      const dados = await exportacaoService.clinica({ aoProgredir: (feitos, total) => setProgresso({ feitos, total }) });
      baixarJson(nomeArquivoExportacao('clinica', dados.clinica?.nome), dados);
      toast.success(`Exportação concluída: ${dados.pacientes.length} paciente(s).`);
    } catch (err) {
      toast.error('Não foi possível exportar a clínica: ' + (err?.message || 'erro de conexão'));
    } finally {
      setProgresso(null);
    }
  };
  return (
    <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 6px' }}>Exportar dados da clínica</h3>
      <p style={{ margin: '0 0 12px', fontSize: '16px', color: '#666' }}>
        Arquivo JSON com todos os pacientes e prontuários (registros, autoria, datas, retificações), agenda, cobranças,
        catálogos, dados da clínica e profissionais. A exportação fica registrada na auditoria. Guarde o arquivo com o
        mesmo cuidado de um prontuário.
      </p>
      {podeExportar ? (
        <button onClick={exportar} disabled={progresso !== null} style={{ padding: '8px 16px', cursor: progresso ? 'not-allowed' : 'pointer' }}>
          {progresso ? `Exportando... ${progresso.feitos}${progresso.total != null ? ` de ${progresso.total}` : ''} pacientes` : 'Exportar clínica'}
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: '16px', color: '#92400e' }}>
          Exige uma conta de Administrador com papel clínico concedido por outro administrador (Usuários).
        </p>
      )}
    </div>
  );
}

const PAPEL_CLINICO_OPCOES = ['', 'Médico', 'Enfermeiro(a)'];

// Sigla do conselho ao lado do número, pela função escolhida — o número
// é o mesmo campo para todos (CRM, COREN, CRP, CREFITO).
function SiglaConselho({ funcao }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '15px', color: '#374151', whiteSpace: 'nowrap' }}>
      {CONSELHO_POR_FUNCAO[funcao] || '—'}
    </span>
  );
}

// Quem atende e, portanto, tem produção e repasse (migração 50).
const ehProfissional = (u) => FUNCOES_CLINICAS.includes(u.funcao) || (u.funcao === 'Administrador' && !!u.papel_clinico_administrador);
const REPASSE_VAZIO = { consulta: 0, exame: 0, procedimento: 0 };
const textoRepasse = (r) => (r
  ? `consultas ${r.consulta.toLocaleString('pt-BR')}% · exames ${r.exame.toLocaleString('pt-BR')}% · procedimentos ${r.procedimento.toLocaleString('pt-BR')}%`
  : 'não definido (0%)');

export function UsuariosPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [form, setForm] = React.useState({ nome: '', email: '', funcao: 'Médico', crm: '', uf: '', sexo: '', nascimento: '', cpf: '', especialidade: '', area_atuacao: '', rqe: '' });
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [editando, setEditando] = React.useState(null); // { id, nome, funcao, crm }
  const [salvandoEdicaoUsuario, setSalvandoEdicaoUsuario] = React.useState(false);
  const [processandoStatusId, setProcessandoStatusId] = React.useState(null);
  const [processandoPapelClinicoId, setProcessandoPapelClinicoId] = React.useState(null);
  // Regras de repasse por profissional, indexadas pelo id do perfil.
  const [repasses, setRepasses] = React.useState({});
  const [erroRepasses, setErroRepasses] = React.useState(false);

  React.useEffect(() => {
    usuariosService.listar()
      .then(setUsuarios)
      .catch(() => toast.error('Não foi possível carregar os usuários. Recarregue a página para tentar novamente.'))
      .finally(() => setCarregando(false));
    repasseService.listar()
      .then(lista => setRepasses(Object.fromEntries(lista.map(r => [r.profissionalId, r]))))
      .catch(() => setErroRepasses(true));
  }, [toast]);

  const criarUsuario = async (e) => {
    e.preventDefault();
    setMsg(null);
    setSalvando(true);
    try {
      await comTimeout(usuariosService.criar({ nome: form.nome, email: form.email, funcao: form.funcao, crm: form.crm, uf: form.uf, sexo: form.sexo, nascimento: form.nascimento, cpf: form.cpf, especialidade: form.especialidade, area_atuacao: form.area_atuacao, rqe: form.rqe }));
      const lista = await comTimeout(usuariosService.listar());
      setUsuarios(lista);
      setForm({ nome: '', email: '', funcao: 'Médico', crm: '', uf: '', sexo: '', nascimento: '', cpf: '', especialidade: '', area_atuacao: '', rqe: '' });
      setMsg({ tipo: 'sucesso', texto: `Convite enviado para ${form.email}. O usuário definirá a própria senha pelo link de uso único.` });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async () => {
    if (!editando?.nome.trim()) return;
    const { repasse, ...dados } = editando;
    const repasseMudou = repasse && ['consulta', 'exame', 'procedimento'].some(k => Number(repasse[k]) !== (repasses[editando.id] || REPASSE_VAZIO)[k]);
    if (repasse && ['consulta', 'exame', 'procedimento'].some(k => repasse[k] === '' || !(Number(repasse[k]) >= 0 && Number(repasse[k]) <= 100))) {
      toast.warning('Os percentuais de repasse vão de 0 a 100.');
      return;
    }
    setSalvandoEdicaoUsuario(true);
    try {
      await comTimeout(usuariosService.atualizar(editando.id, dados));
      setUsuarios(prev => prev.map(u => u.id === editando.id ? { ...u, ...dados } : u));
      if (repasseMudou) {
        const salvo = await comTimeout(repasseService.salvar(editando.id, repasse));
        setRepasses(prev => ({ ...prev, [editando.id]: salvo }));
      }
      setEditando(null);
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSalvandoEdicaoUsuario(false);
    }
  };

  const alterarStatus = async (id, ativoAtual) => {
    setProcessandoStatusId(id);
    try {
      await comTimeout(usuariosService.alterarStatus(id, !ativoAtual));
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ativo: !ativoAtual } : u));
    } catch (err) {
      toast.error('Erro ao alterar status: ' + err.message);
    } finally {
      setProcessandoStatusId(null);
    }
  };

  // Só existe para conta Administrador que não é a própria: o banco
  // recusa autoconcessão mesmo vinda de um Administrador (migração 30) —
  // conceder um papel clínico aqui é decisão de outra pessoa, deliberada.
  const alterarPapelClinico = async (id, papel) => {
    setProcessandoPapelClinicoId(id);
    try {
      await comTimeout(usuariosService.concederPapelClinico(id, papel || null));
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, papel_clinico_administrador: papel || null } : u));
    } catch (err) {
      toast.error('Erro ao alterar papel clínico: ' + err.message);
    } finally {
      setProcessandoPapelClinicoId(null);
    }
  };

  const funcaoIcone = { 'Médico': '👨‍⚕️', 'Enfermeiro(a)': '👩‍⚕️', 'Psicólogo(a)': '🧠', 'Fisioterapeuta': '🦴', 'Recepcionista': '💼', 'Financeiro': '💰', 'Administrador': '⚙️' };

  return (
    <div>
      <Header />
      <Link to="/painel">← Voltar ao Painel</Link>

      <h2 style={{ marginTop: '20px' }}>Gerenciar Usuários do Sistema</h2>

      {/* Formulário novo usuário */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Novo Usuário</h3>
        <form onSubmit={criarUsuario}>
          <div className="form-grid-3col" style={{ marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome completo *</label>
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Dr. João Silva" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>E-mail *</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@clinica.com" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Função</label>
              <select value={form.funcao} onChange={e => setForm({ ...form, funcao: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: '16px' }}>
                {FUNCOES_USUARIO.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Conselho Profissional <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(profissionais de saúde)</span></label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <SiglaConselho funcao={form.funcao} />
                <input value={form.crm} onChange={e => setForm({ ...form, crm: e.target.value.replace(/\D/g, '') })} placeholder="Número" inputMode="numeric" style={{ flex: 2, minWidth: 0, padding: '8px' }} />
                <select value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value })} style={{ flex: 1, minWidth: 0, padding: '8px', fontSize: '16px' }}>
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            {form.funcao === 'Médico' && (
              <div>
                <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>RQE <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(se especialista)</span></label>
                <input value={form.rqe} onChange={e => setForm({ ...form, rqe: e.target.value.replace(/\D/g, '') })} placeholder="Número do RQE" inputMode="numeric" style={{ width: '100%', padding: '8px' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sexo</label>
              <select value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: '16px' }}>
                <option value="">Não informado</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data de nascimento</label>
              <input type="date" value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CPF</label>
              <input value={form.cpf} onChange={e => setForm({ ...form, cpf: formatarCPF(e.target.value) })} placeholder="000.000.000-00" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Especialidade médica</label>
              <input value={form.especialidade} onChange={e => setForm({ ...form, especialidade: e.target.value })} placeholder="Ex: Cardiologia" list="lista-especialidades" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Área de atuação</label>
              <input value={form.area_atuacao} onChange={e => setForm({ ...form, area_atuacao: e.target.value })} placeholder="Ex: Cardiologia Intervencionista" style={{ width: '100%', padding: '8px' }} />
            </div>
            <datalist id="lista-especialidades">
              {['Cardiologia','Clínica Médica','Endocrinologia','Gastroenterologia','Geriatria',
                'Ginecologia','Neurologia','Oftalmologia','Ortopedia','Pediatria',
                'Pneumologia','Psiquiatria','Reumatologia','Urologia'].map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', backgroundColor: msg.tipo === 'sucesso' ? '#d1fae5' : '#fee2e2', color: msg.tipo === 'sucesso' ? '#065f46' : '#991b1b', fontSize: '16px' }}>
              {msg.tipo === 'sucesso' ? '✓ ' : '⚠ '}{msg.texto}
            </div>
          )}

          <button type="submit" disabled={salvando} style={{ padding: '10px 20px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Enviando convite...' : '+ Convidar Usuário'}
          </button>
          <p style={{ margin: '10px 0 0', fontSize: '16px', color: '#6b7280' }}>
            O usuário receberá um link de uso único e criará a própria senha. O administrador nunca terá acesso a ela.
          </p>
        </form>
      </div>

      {/* Lista de usuários */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Usuários Cadastrados ({usuarios.length})</h3>
        {carregando ? (
          <p style={{ color: '#666' }}>Carregando...</p>
        ) : usuarios.length === 0 ? (
          <p style={{ color: '#999' }}>Nenhum usuário encontrado. Faça logout e login novamente para que seu perfil apareça aqui.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {usuarios.map(u => (
              <div key={u.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: u.ativo ? '#fff' : '#f9fafb', opacity: u.ativo ? 1 : 0.65, overflow: 'hidden' }}>

                {/* Modo visualização */}
                {editando?.id !== u.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '50%', backgroundColor: u.ativo ? '#dbeafe' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                      {funcaoIcone[u.funcao] || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#111' }}>{u.nome}</div>
                      <div style={{ fontSize: '16px', color: '#6b7280' }}>{u.email}</div>
                      <div style={{ fontSize: '16px', color: '#9ca3af', marginTop: '2px' }}>
                        {u.funcao}{u.crm ? ` · ${CONSELHO_POR_FUNCAO[u.papel_clinico_administrador || u.funcao] || 'Conselho'} ${u.crm}${u.uf ? '/' + u.uf : ''}` : ''}{u.rqe ? ` · RQE ${u.rqe}` : ''}
                        {u.funcao === 'Administrador' && u.papel_clinico_administrador ? ` · atua como ${u.papel_clinico_administrador}` : ''}
                      </div>
                      {ehProfissional(u) && (
                        <div style={{ fontSize: '15px', color: '#6b7280', marginTop: '2px' }}>
                          Repasse: {erroRepasses ? 'não foi possível carregar' : textoRepasse(repasses[u.id])}
                        </div>
                      )}
                      {u.funcao === 'Administrador' && u.id !== user?.id && (
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ fontSize: '15px', color: '#6b7280' }}>Papel clínico adicional:</label>
                          <select
                            value={u.papel_clinico_administrador || ''}
                            disabled={processandoPapelClinicoId === u.id}
                            onChange={e => alterarPapelClinico(u.id, e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '15px' }}
                          >
                            {PAPEL_CLINICO_OPCOES.map(p => <option key={p} value={p}>{p || 'Nenhum'}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px', padding: '3px 10px', borderRadius: '10px', backgroundColor: u.ativo ? '#d1fae5' : '#fee2e2', color: u.ativo ? '#065f46' : '#991b1b', fontWeight: '500' }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <button onClick={() => setEditando({ id: u.id, nome: u.nome, funcao: u.funcao, crm: u.crm || '', uf: u.uf || '', sexo: u.sexo || '', nascimento: u.nascimento || '', cpf: u.cpf || '', especialidade: u.especialidade || '', area_atuacao: u.area_atuacao || '', cbo: u.cbo || '', rqe: u.rqe || '', repasse: ehProfissional(u) ? (({ consulta, exame, procedimento }) => ({ consulta, exame, procedimento }))(repasses[u.id] || REPASSE_VAZIO) : null })} style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => alterarStatus(u.id, u.ativo)}
                        disabled={processandoStatusId === u.id}
                        style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: u.ativo ? '#fee2e2' : '#d1fae5', color: u.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: processandoStatusId === u.id ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: processandoStatusId === u.id ? 0.6 : 1 }}
                      >
                        {processandoStatusId === u.id ? '...' : (u.ativo ? 'Desativar' : 'Reativar')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Modo edição inline */}
                {editando?.id === u.id && (
                  <div style={{ padding: '14px 16px', backgroundColor: '#f0f9ff', borderTop: '2px solid #0369a1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Nome</label>
                        <input value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Função</label>
                        <select value={editando.funcao} onChange={e => setEditando({ ...editando, funcao: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '16px' }}>
                          {FUNCOES_USUARIO.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Conselho Profissional</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <SiglaConselho funcao={editando.funcao} />
                          <input value={editando.crm || ''} onChange={e => setEditando({ ...editando, crm: e.target.value.replace(/\D/g, '') })} placeholder="Número" inputMode="numeric" style={{ flex: 2, minWidth: 0, padding: '7px', fontSize: '16px' }} />
                          <select value={editando.uf || ''} onChange={e => setEditando({ ...editando, uf: e.target.value })} style={{ flex: 1, minWidth: 0, padding: '7px', fontSize: '16px' }}>
                            <option value="">UF</option>
                            {UFS.map(uf => <option key={uf}>{uf}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Sexo</label>
                        <select value={editando.sexo || ''} onChange={e => setEditando({ ...editando, sexo: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '16px' }}>
                          <option value="">Não informado</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Data de nascimento</label>
                        <input type="date" value={editando.nascimento || ''} onChange={e => setEditando({ ...editando, nascimento: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>CPF</label>
                        <input value={editando.cpf || ''} onChange={e => setEditando({ ...editando, cpf: formatarCPF(e.target.value) })} placeholder="000.000.000-00" style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Especialidade médica</label>
                        <input value={editando.especialidade || ''} onChange={e => setEditando({ ...editando, especialidade: e.target.value })} placeholder="Ex: Cardiologia" list="lista-especialidades" style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Área de atuação</label>
                        <input value={editando.area_atuacao || ''} onChange={e => setEditando({ ...editando, area_atuacao: e.target.value })} placeholder="Ex: Cardiologia Intervencionista" style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                      {editando.funcao === 'Médico' && (
                        <div>
                          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>RQE</label>
                          <input value={editando.rqe || ''} onChange={e => setEditando({ ...editando, rqe: e.target.value.replace(/\D/g, '') })} placeholder="Número do RQE" inputMode="numeric" style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Código CBO</label>
                        <input value={editando.cbo || ''} onChange={e => setEditando({ ...editando, cbo: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="Ex: 225125 — sai na guia SP/SADT" inputMode="numeric" style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                      </div>
                    </div>
                    {editando.repasse && (
                      <fieldset style={{ border: '1px solid #bae6fd', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px' }}>
                        <legend style={{ fontSize: '16px', fontWeight: 'bold' }}>Repasse ao profissional (% sobre o valor de cada atendimento)</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                          {[['consulta', 'Consultas'], ['exame', 'Exames'], ['procedimento', 'Procedimentos']].map(([k, nome]) => (
                            <div key={k}>
                              <label htmlFor={`repasse-${k}`} style={{ fontSize: '16px', display: 'block', marginBottom: '3px' }}>{nome} (%)</label>
                              <input id={`repasse-${k}`} type="number" min="0" max="100" step="0.01" value={editando.repasse[k]}
                                onChange={e => setEditando({ ...editando, repasse: { ...editando.repasse, [k]: e.target.value } })}
                                style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '6px 0 0' }}>
                          Vale para as cobranças lançadas daqui em diante; as já lançadas guardam o percentual da época.
                          O tipo de cada procedimento está em Financeiro → Convênios e tabelas → Procedimentos.
                        </p>
                      </fieldset>
                    )}
                    <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '10px' }}>
                      E-mail: <strong>{u.email}</strong> <span style={{ color: '#9ca3af' }}>(não editável)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={salvarEdicao} disabled={salvandoEdicaoUsuario} style={{ padding: '7px 16px', backgroundColor: salvandoEdicaoUsuario ? '#9ca3af' : '#0369a1', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoEdicaoUsuario ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                        {salvandoEdicaoUsuario ? 'Salvando...' : '✓ Salvar'}
                      </button>
                      <button onClick={() => setEditando(null)} style={{ padding: '7px 12px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ROTULOS_TABELA = {
  pacientes: 'Paciente',
  consultas: 'Registro clínico',
  medicamentos_receita: 'Item de receituário',
  perfis: 'Usuário',
  configuracoes_clinica: 'Configurações da clínica',
  filiais: 'Filial',
  cobrancas: 'Cobrança',
  repasse_profissional: 'Regra de repasse',
};

const ROTULOS_OPERACAO = {
  INSERT: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
};

const ROTULOS_ACAO = {
  abrir_prontuario: 'Abriu o prontuário',
  abrir_registro: 'Abriu um registro',
  imprimir_documento: 'Gerou documento',
  exportar_prontuario: 'Exportou o prontuário',
  exportar_clinica: 'Exportou a clínica inteira',
};

// Aba "Acessos" (migração 38): leitura de prontuários e documentos
// gerados — quem, quando e de qual paciente. Nada clínico.
function AcessosAuditoria() {
  const [acessos, setAcessos] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [filtro, setFiltro] = React.useState('');

  React.useEffect(() => {
    acessosService.listar({ limite: 500 })
      .then(setAcessos)
      .catch(err => setErro(err.message || 'Erro ao carregar os acessos.'))
      .finally(() => setCarregando(false));
  }, []);

  const termo = filtro.trim().toLowerCase();
  const filtrados = termo
    ? acessos.filter(a => `${a.usuario_nome || ''} ${a.paciente_nome || ''} ${a.detalhe || ''}`.toLowerCase().includes(termo))
    : acessos;

  return (
    <>
      <p style={{ color: '#666', fontSize: '16px', marginTop: '-8px' }}>
        Últimos {acessos.length} acessos: prontuários abertos e documentos gerados.
      </p>
      <input
        placeholder="Filtrar por profissional, paciente ou documento..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        style={{ width: '100%', maxWidth: '480px', padding: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
      />
      {erro && <p style={{ color: '#dc2626' }}>{erro}</p>}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {carregando ? (
          <p style={{ padding: '20px', color: '#666' }}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ padding: '20px', color: '#666' }}>Nenhum acesso encontrado.</p>
        ) : filtrados.map(a => (
          <div key={a.id} style={{ borderBottom: '1px solid #eee', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '15px' }}>
            <div>
              <strong>{a.usuario_nome || a.usuario_id}</strong>
              {a.usuario_funcao && <span style={{ color: '#888' }}> ({a.usuario_funcao})</span>}
              {' — '}{ROTULOS_ACAO[a.acao] || a.acao}
              {a.detalhe && <span>: {a.detalhe}</span>}
              {' · '}<span style={{ color: '#1d4ed8' }}>{a.paciente_nome || a.paciente_id}</span>
            </div>
            <div style={{ color: '#666' }}>{new Date(a.em).toLocaleString('pt-BR')}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function AuditoriaPage() {
  const [aba, setAba] = React.useState('alteracoes');
  const [eventos, setEventos] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [filtroTabela, setFiltroTabela] = React.useState('');
  const [expandido, setExpandido] = React.useState(null);

  React.useEffect(() => {
    Promise.all([auditoriaService.listar(), usuariosService.listar()])
      .then(([listaEventos, listaUsuarios]) => {
        setEventos(listaEventos);
        setUsuarios(listaUsuarios);
      })
      .catch(err => setErro(err.message || 'Erro ao carregar auditoria.'))
      .finally(() => setCarregando(false));
  }, []);

  const nomeUsuario = (id) => {
    const u = usuarios.find(u => u.id === id);
    return u ? `${u.nome} (${u.email})` : (id || '—');
  };

  const eventosFiltrados = filtroTabela
    ? eventos.filter(e => e.tabela === filtroTabela)
    : eventos;

  return (
    <div>
      <Header />
      <Link to="/painel">← Voltar ao Painel</Link>

      <h2 style={{ marginTop: '20px' }}>Auditoria</h2>
      <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {[['alteracoes', 'Alterações'], ['acessos', 'Acessos']].map(([valor, rotulo]) => (
          <button key={valor} role="tab" aria-selected={aba === valor} onClick={() => setAba(valor)}
            style={{ padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #1d4ed8',
              backgroundColor: aba === valor ? '#1d4ed8' : 'white', color: aba === valor ? 'white' : '#1d4ed8' }}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'acessos' ? <AcessosAuditoria /> : (
      <>
      <p style={{ color: '#666', fontSize: '16px', marginTop: '-8px' }}>
        Últimos {eventos.length} eventos de criação, alteração e exclusão registrados no banco.
      </p>

      <div style={{ marginBottom: '16px' }}>
        <select value={filtroTabela} onChange={e => setFiltroTabela(e.target.value)} style={{ padding: '8px' }}>
          <option value="">Todas as tabelas</option>
          {Object.entries(ROTULOS_TABELA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
      </div>

      {erro && <p style={{ color: '#dc2626' }}>{erro}</p>}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {carregando ? (
          <p style={{ padding: '20px', color: '#666' }}>Carregando...</p>
        ) : eventosFiltrados.length === 0 ? (
          <p style={{ padding: '20px', color: '#666' }}>Nenhum evento encontrado.</p>
        ) : (
          eventosFiltrados.map(ev => (
            <div key={ev.id} style={{ borderBottom: '1px solid #eee', padding: '12px 16px' }}>
              <div
                onClick={() => setExpandido(expandido === ev.id ? null : ev.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '16px' }}>
                  <strong>{ROTULOS_OPERACAO[ev.operacao] || ev.operacao}</strong>
                  {' — '}{ROTULOS_TABELA[ev.tabela] || ev.tabela}
                  <span style={{ color: '#888' }}> · {nomeUsuario(ev.alterado_por)}</span>
                </div>
                <div style={{ fontSize: '16px', color: '#666' }}>
                  {new Date(ev.alterado_em).toLocaleString('pt-BR')}
                </div>
              </div>

              {expandido === ev.id && (
                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '16px', color: '#888' }}>ANTES</strong>
                    <pre style={{ fontSize: '11px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '260px' }}>
                      {ev.dados_antigos ? JSON.stringify(ev.dados_antigos, null, 2) : '—'}
                    </pre>
                  </div>
                  <div>
                    <strong style={{ fontSize: '16px', color: '#888' }}>DEPOIS</strong>
                    <pre style={{ fontSize: '11px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '260px' }}>
                      {ev.dados_novos ? JSON.stringify(ev.dados_novos, null, 2) : '—'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}

// Mostra um campo em modo leitura (fora de edição) — mesmo rótulo do
// modo edição, só que como texto simples em vez de input.
function CampoVisualizacao({ label, valor }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#374151' }}>{label}</div>
      <div style={{ fontSize: '16px', color: valor ? '#111827' : '#9ca3af' }}>{valor || 'Não informado'}</div>
    </div>
  );
}

export function ConfiguracoesClinicaPage() {
  const toast = useToast();
  const { clinica, recarregar } = useClinica();
  const [editando, setEditando] = React.useState(false);
  const [form, setForm] = React.useState(clinica);
  const [salvando, setSalvando] = React.useState(false);
  const [enviandoLogo, setEnviandoLogo] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState('');

  React.useEffect(() => { setForm(clinica); }, [clinica]);

  const formatarCEPLocal = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 8);
    return n.length <= 5 ? n : `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  const buscarCEP = async (cepFormatado) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const endereco = [data.logradouro, data.bairro].filter(Boolean).join(', ');
        const cidade = [data.localidade, data.uf].filter(Boolean).join(' - ');
        setForm(prev => ({ ...prev, endereco: endereco || prev.endereco, cidade: cidade || prev.cidade }));
      }
    } catch (_) {}
  };

  const enviarLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoLogo(true);
    try {
      const url = await comTimeout(configuracoesService.uploadLogo(file));
      setForm(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      toast.error('Erro ao enviar logomarca: ' + err.message);
    } finally {
      setEnviandoLogo(false);
    }
  };

  const cancelarEdicao = () => {
    setForm(clinica);
    setEditando(false);
    setErro('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    setSalvo(false);
    if (!clinica.id) {
      setErro('Configurações ainda não carregadas — recarregue a página.');
      return;
    }
    setSalvando(true);
    try {
      await comTimeout(configuracoesService.atualizar(clinica.id, form));
      recarregar();
      setSalvo(true);
      setEditando(false);
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const campoStyle = { width: '100%', padding: '8px' };
  const labelStyle = { fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  return (
    <div>
      <Header />
      <Link to="/painel">← Voltar ao Painel</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
        <h2 style={{ margin: 0 }}>Configurações da Clínica</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/filiais" style={{ padding: '8px 14px', fontSize: '16px', textDecoration: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px' }}>
            🏢 Filiais
          </Link>
          {!editando && (
            <button onClick={() => setEditando(true)} style={{ padding: '8px 14px', fontSize: '16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✏️ Editar
            </button>
          )}
        </div>
      </div>
      <p style={{ color: '#9ca3af', fontSize: '16px', marginTop: '4px' }}>
        Toda alteração fica registrada na Auditoria, com data e quem editou.
      </p>

      {erro && <p style={{ color: '#dc2626', fontSize: '16px' }}>{erro}</p>}

      <form onSubmit={salvar}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

          {/* Logomarca, nome, nome fantasia, CNPJ */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0 }}>Logomarca</h3>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <div style={{ width: '220px', height: '220px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="Logomarca da clínica" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '16px', color: '#9ca3af' }}>sem logo</span>}
              </div>
            </div>
            {editando && (
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <input type="file" accept="image/*" onChange={enviarLogo} disabled={enviandoLogo} style={{ fontSize: '16px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '16px', color: '#9ca3af' }}>Prefira uma imagem quadrada em boa resolução.</p>
                {enviandoLogo && <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>Enviando...</p>}
              </div>
            )}

            {editando ? (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Nome da clínica <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(razão social)</span></label>
                  <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campoStyle} />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Nome Fantasia</label>
                  <input value={form.nomeFantasia} onChange={e => setForm({ ...form, nomeFantasia: e.target.value })} style={campoStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CNPJ</label>
                  <input
                    value={form.cnpj}
                    onChange={e => setForm({ ...form, cnpj: formatarCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    style={campoStyle}
                  />
                </div>
              </>
            ) : (
              <>
                <CampoVisualizacao label="Nome da clínica (razão social)" valor={clinica.nome} />
                <CampoVisualizacao label="Nome Fantasia" valor={clinica.nomeFantasia} />
                <CampoVisualizacao label="CNPJ" valor={clinica.cnpj} />
              </>
            )}
          </div>

          {/* Endereço e contato */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0 }}>Endereço e Contato</h3>

            {editando ? (
              <>
                <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>CEP</label>
                    <input
                      value={form.cep}
                      onChange={e => {
                        const cepFormatado = formatarCEPLocal(e.target.value);
                        setForm(prev => ({ ...prev, cep: cepFormatado }));
                        buscarCEP(cepFormatado);
                      }}
                      maxLength={9}
                      style={campoStyle}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Endereço <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(preenchido pelo CEP)</span></label>
                    <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} style={campoStyle} />
                  </div>
                </div>
                <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Número</label>
                    <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={campoStyle} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Complemento <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(sala, andar...)</span></label>
                    <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} style={campoStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Cidade / UF</label>
                  <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} style={campoStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Telefone / e-mail de contato</label>
                  <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} style={campoStyle} />
                </div>
              </>
            ) : (
              <>
                <CampoVisualizacao label="CEP" valor={clinica.cep} />
                <CampoVisualizacao label="Endereço" valor={clinica.endereco} />
                <CampoVisualizacao label="Número" valor={clinica.numero} />
                <CampoVisualizacao label="Complemento" valor={clinica.complemento} />
                <CampoVisualizacao label="Cidade / UF" valor={clinica.cidade} />
                <CampoVisualizacao label="Telefone / e-mail de contato" valor={clinica.telefone} />
              </>
            )}

            <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', fontSize: '16px', color: '#9ca3af' }}>
              Esses dados aparecem no cabeçalho e rodapé de receitas, atestados, relatórios, guia TISS e recibos.
            </div>

            {editando && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px' }}>
                <button type="submit" disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {salvando ? 'Salvando...' : '✓ Salvar'}
                </button>
                <button type="button" onClick={cancelarEdicao} style={{ padding: '10px 18px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo!</span>}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

const FILIAL_VAZIA = {
  nome: '', nomeFantasia: '', cnpj: '', cep: '', endereco: '',
  numero: '', complemento: '', cidade: '', telefone: '', logoUrl: '',
};

// Mesma estrutura de Configurações da Clínica, mas em lista — várias
// unidades, cada uma com sua própria logomarca.
export function FiliaisPage() {
  const toast = useToast();
  const [filiais, setFiliais] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState(null);
  const [form, setForm] = React.useState(FILIAL_VAZIA);
  const [salvando, setSalvando] = React.useState(false);
  const [enviandoLogo, setEnviandoLogo] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [processandoId, setProcessandoId] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    filiaisService.listar()
      .then(setFiliais)
      .catch(err => setErro(err.message || 'Erro ao carregar filiais.'))
      .finally(() => setCarregando(false));
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const formatarCEPLocal = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 8);
    return n.length <= 5 ? n : `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  const buscarCEP = async (cepFormatado) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const endereco = [data.logradouro, data.bairro].filter(Boolean).join(', ');
        const cidade = [data.localidade, data.uf].filter(Boolean).join(' - ');
        setForm(prev => ({ ...prev, endereco: endereco || prev.endereco, cidade: cidade || prev.cidade }));
      }
    } catch (_) {}
  };

  const enviarLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoLogo(true);
    try {
      const url = await comTimeout(filiaisService.uploadLogo(file));
      setForm(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      toast.error('Erro ao enviar logomarca: ' + err.message);
    } finally {
      setEnviandoLogo(false);
    }
  };

  const novaFilial = () => {
    setForm(FILIAL_VAZIA);
    setEditandoId(null);
    setMostrarForm(true);
  };

  const editarFilial = (filial) => {
    setForm(filial);
    setEditandoId(filial.id);
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelar = () => {
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FILIAL_VAZIA);
    setErro('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) {
      setErro('Informe o nome da filial.');
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        const atualizada = await comTimeout(filiaisService.atualizar(editandoId, form));
        setFiliais(prev => prev.map(f => f.id === editandoId ? atualizada : f).sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        const criada = await comTimeout(filiaisService.criar(form));
        setFiliais(prev => [...prev, criada].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      cancelar();
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (filial) => {
    setProcessandoId(filial.id);
    try {
      await comTimeout(filiaisService.alterarStatus(filial.id, !filial.ativo));
      setFiliais(prev => prev.map(f => f.id === filial.id ? { ...f, ativo: !filial.ativo } : f));
    } catch (err) {
      toast.error('Erro ao alterar status: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const campoStyle = { width: '100%', padding: '8px' };
  const labelStyle = { fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  return (
    <div>
      <Header />
      <Link to="/configuracoes">← Voltar a Configurações da Clínica</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
        <h2 style={{ margin: 0 }}>Filiais</h2>
        {!mostrarForm && (
          <button onClick={novaFilial} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Nova Filial
          </button>
        )}
      </div>

      {erro && <p style={{ color: '#dc2626', fontSize: '16px' }}>{erro}</p>}

      {mostrarForm && (
        <form onSubmit={salvar} style={{ marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0 }}>Logomarca</h3>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <div style={{ width: '220px', height: '220px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {form.logoUrl
                    ? <img src={form.logoUrl} alt="Logomarca da filial" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '16px', color: '#9ca3af' }}>sem logo</span>}
                </div>
              </div>
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <input type="file" accept="image/*" onChange={enviarLogo} disabled={enviandoLogo} style={{ fontSize: '16px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '16px', color: '#9ca3af' }}>Prefira uma imagem quadrada em boa resolução.</p>
                {enviandoLogo && <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>Enviando...</p>}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Nome da filial <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(razão social) *</span></label>
                <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campoStyle} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Nome Fantasia</label>
                <input value={form.nomeFantasia} onChange={e => setForm({ ...form, nomeFantasia: e.target.value })} style={campoStyle} />
              </div>
              <div>
                <label style={labelStyle}>CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={e => setForm({ ...form, cnpj: formatarCNPJ(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  style={campoStyle}
                />
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0 }}>Endereço e Contato</h3>

              <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>CEP</label>
                  <input
                    value={form.cep}
                    onChange={e => {
                      const cepFormatado = formatarCEPLocal(e.target.value);
                      setForm(prev => ({ ...prev, cep: cepFormatado }));
                      buscarCEP(cepFormatado);
                    }}
                    maxLength={9}
                    style={campoStyle}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Endereço <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(preenchido pelo CEP)</span></label>
                  <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} style={campoStyle} />
                </div>
              </div>
              <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Número</label>
                  <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={campoStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Complemento <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(sala, andar...)</span></label>
                  <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} style={campoStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Cidade / UF</label>
                <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} style={campoStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Telefone / e-mail de contato</label>
                <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} style={campoStyle} />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="submit" disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {salvando ? 'Salvando...' : (editandoId ? '✓ Salvar Alterações' : '✓ Cadastrar Filial')}
                </button>
                <button type="button" onClick={cancelar} style={{ padding: '10px 18px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
        {carregando ? (
          <p style={{ color: '#666' }}>Carregando...</p>
        ) : filiais.length === 0 ? (
          <p style={{ color: '#666' }}>Nenhuma filial cadastrada ainda.</p>
        ) : (
          filiais.map(filial => (
            <div key={filial.id} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', opacity: filial.ativo ? 1 : 0.5 }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {filial.logoUrl
                  ? <img src={filial.logoUrl} alt={filial.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '18px' }}>🏢</span>}
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <strong>{filial.nome}</strong>{!filial.ativo && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#dc2626' }}>(inativa)</span>}
                <div style={{ fontSize: '16px', color: '#666' }}>
                  {[filial.cidade, filial.telefone].filter(Boolean).join(' · ') || 'Endereço e telefone não informados'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => editarFilial(filial)} style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>
                  Editar
                </button>
                <button
                  onClick={() => alternarAtivo(filial)}
                  disabled={processandoId === filial.id}
                  style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: filial.ativo ? '#fee2e2' : '#d1fae5', color: filial.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: processandoId === filial.id ? 'not-allowed' : 'pointer' }}
                >
                  {filial.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const EXAME_VAZIO = { nome: '', tuss: '', tipo: 'Laboratorial', categoria: '' };

// Tipos vindos da própria estrutura de capítulos da TUSS (2 primeiros
// dígitos do código) — ver migração 20261014000033. Laboratorial/Imagem
// são os dois relevantes pro Pedido de Exames; os demais (toda a Tabela
// 22 oficial) ficam disponíveis pra buscas e uso futuro.
const TIPOS_EXAME = [
  { valor: 'Laboratorial', rotulo: 'Laboratoriais', icone: '🧪' },
  { valor: 'Imagem', rotulo: 'Imagem', icone: '🩻' },
  { valor: 'Diagnóstico', rotulo: 'Diagnóstico (não classificado)', icone: '🔬' },
  { valor: 'Consulta', rotulo: 'Consultas', icone: '🩺' },
  { valor: 'Terapia', rotulo: 'Terapias', icone: '💉' },
  { valor: 'Cirurgia', rotulo: 'Cirurgia', icone: '🔪' },
  { valor: 'Atendimento', rotulo: 'Atendimento', icone: '🏥' },
  { valor: 'Odontologia', rotulo: 'Odontologia', icone: '🦷' },
];

// Catálogo de exames do Pedido de Exames (seção 4 do Documento Mestre,
// item pedido pelo médico responsável) — importado da Tabela 22 da TUSS
// na íntegra (~5.970 procedimentos; ver migração
// 20261014000033_importar_tabela_tuss_completa.sql). No Pedido de
// Exames o médico busca por nome/código TUSS em vez de escolher de uma
// lista; esta tela é só pra cadastrar/corrigir/desativar itens.
export function CatalogoExamesPage() {
  const toast = useToast();
  const [exames, setExames] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [filtroTexto, setFiltroTexto] = React.useState('');
  const [filtroTipo, setFiltroTipo] = React.useState('Laboratorial');

  const [mostrarForm, setMostrarForm] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState(null);
  const [form, setForm] = React.useState(EXAME_VAZIO);
  const [salvando, setSalvando] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);

  const carregar = React.useCallback(() => {
    setCarregando(true);
    examesService.listar()
      .then(setExames)
      .catch(err => setErro(err.message || 'Erro ao carregar catálogo de exames.'))
      .finally(() => setCarregando(false));
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const campoStyle = { width: '100%', padding: '8px' };
  const labelStyle = { fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  const novoExame = () => {
    setForm(EXAME_VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  };

  const editarExame = (exame) => {
    setForm({ nome: exame.nome, tuss: exame.tuss, tipo: exame.tipo, categoria: exame.categoria });
    setEditandoId(exame.id);
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelar = () => {
    setMostrarForm(false);
    setEditandoId(null);
    setForm(EXAME_VAZIO);
    setErro('');
  };

  const salvarExame = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) {
      setErro('Informe o nome do exame.');
      return;
    }
    setSalvando(true);
    try {
      if (editandoId) {
        const atual = exames.find(ex => ex.id === editandoId);
        const atualizado = await comTimeout(examesService.atualizar(editandoId, { ...form, ativo: atual?.ativo ?? true }));
        setExames(prev => prev.map(ex => ex.id === editandoId ? atualizado : ex));
      } else {
        const criado = await comTimeout(examesService.criar(form));
        setExames(prev => [...prev, criado]);
      }
      cancelar();
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivoExame = async (exame) => {
    setProcessandoId(exame.id);
    try {
      await comTimeout(examesService.alterarStatus(exame.id, !exame.ativo));
      setExames(prev => prev.map(ex => ex.id === exame.id ? { ...ex, ativo: !exame.ativo } : ex));
    } catch (err) {
      toast.error('Erro ao alterar status: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  // Catálogo tem ~5.970 itens (Tabela 22 completa da TUSS) — listar tudo
  // de uma vez travaria a tela. Exige tipo selecionado e, acima de
  // LIMITE_LISTA resultados, também um texto de busca.
  const LIMITE_LISTA = 300;
  const contagemPorTipo = TIPOS_EXAME.map(t => ({ ...t, total: exames.filter(ex => ex.tipo === t.valor).length }));
  const doTipo = exames.filter(ex => ex.tipo === filtroTipo);
  // Com busca, ordena por relevância (ver pontuarCorrespondencia) antes
  // do corte de LIMITE_LISTA — senão um termo curto como "rm" some
  // atrás de centenas de itens que só contêm essas letras no meio de
  // outra palavra, mesmo com o limite alto.
  const filtrados = filtroTexto.trim()
    ? doTipo
        .map(ex => ({ exame: ex, pontuacao: pontuarCorrespondencia(ex, filtroTexto) }))
        .filter(x => x.pontuacao !== null)
        .sort((a, b) => a.pontuacao - b.pontuacao || a.exame.nome.localeCompare(b.exame.nome))
        .map(x => x.exame)
    : doTipo.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const precisaBuscarMais = !filtroTexto.trim() && filtrados.length > LIMITE_LISTA;
  const listaExibida = precisaBuscarMais ? [] : filtrados.slice(0, LIMITE_LISTA);

  return (
    <div>
      <Header />
      <Link to="/painel">← Voltar ao Painel Administrativo</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
        <h2 style={{ margin: 0 }}>Catálogo de Exames</h2>
        {!mostrarForm && (
          <button onClick={novoExame} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Novo Exame
          </button>
        )}
      </div>

      {erro && <p style={{ color: '#dc2626', fontSize: '16px' }}>{erro}</p>}

      {mostrarForm && (
        <form onSubmit={salvarExame} style={{ marginTop: '16px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Nome do exame *</label>
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Código TUSS</label>
              <input value={form.tuss} onChange={e => setForm({ ...form, tuss: e.target.value })} style={campoStyle} />
            </div>
          </div>
          <div className="form-grid-3col" style={{ marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={campoStyle}>
                {TIPOS_EXAME.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Categoria <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(agrupa a lista, ex. "Rotina", "Cardiologia")</span></label>
              <input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={campoStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="submit" disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : (editandoId ? '✓ Salvar Alterações' : '✓ Cadastrar Exame')}
            </button>
            <button type="button" onClick={cancelar} style={{ padding: '10px 18px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {contagemPorTipo.map(t => (
          <button
            key={t.valor}
            onClick={() => setFiltroTipo(t.valor)}
            style={{ padding: '7px 14px', fontSize: '16px', backgroundColor: filtroTipo === t.valor ? '#1d4ed8' : '#e5e7eb', color: filtroTipo === t.valor ? 'white' : '#374151', border: 'none', borderRadius: '999px', cursor: 'pointer', fontWeight: filtroTipo === t.valor ? 'bold' : 'normal' }}
          >
            {t.icone} {t.rotulo} ({t.total})
          </button>
        ))}
      </div>

      <div style={{ marginTop: '12px' }}>
        <input
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          placeholder="Buscar por nome ou código TUSS dentro deste tipo..."
          name="filtro-catalogo-exames-tuss"
          autoComplete="off"
          style={{ width: '100%', maxWidth: '420px', padding: '9px', fontSize: '16px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        {carregando ? (
          <p style={{ color: '#666' }}>Carregando...</p>
        ) : precisaBuscarMais ? (
          <p style={{ color: '#666', fontSize: '16px' }}>
            {filtrados.length} itens em "{TIPOS_EXAME.find(t => t.valor === filtroTipo)?.rotulo}" — digite um nome ou código TUSS acima pra encontrar o que precisa (mostra até {LIMITE_LISTA} de uma vez).
          </p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: '#666', fontSize: '16px' }}>Nenhum exame encontrado.</p>
        ) : (
          <>
            {filtrados.length > LIMITE_LISTA && (
              <p style={{ color: '#9ca3af', fontSize: '16px', marginBottom: '8px' }}>Mostrando {LIMITE_LISTA} de {filtrados.length} resultados — refine a busca pra ver outros.</p>
            )}
            <div style={{ display: 'grid', gap: '8px' }}>
              {listaExibida.map(exame => (
                <div key={exame.id} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '14px', opacity: exame.ativo ? 1 : 0.5 }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <strong>{exame.nome}</strong>{!exame.ativo && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#dc2626' }}>(inativo)</span>}
                    <div style={{ fontSize: '16px', color: '#666' }}>
                      {[exame.categoria, exame.tuss ? `TUSS ${exame.tuss}` : null].filter(Boolean).join(' · ') || 'Sem categoria/TUSS'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => editarExame(exame)} style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button
                      onClick={() => alternarAtivoExame(exame)}
                      disabled={processandoId === exame.id}
                      style={{ padding: '6px 12px', fontSize: '16px', backgroundColor: exame.ativo ? '#fee2e2' : '#d1fae5', color: exame.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: processandoId === exame.id ? 'not-allowed' : 'pointer' }}
                    >
                      {exame.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { useClinica } from '../../hooks/useClinica';
import { Header } from '../../components/common/Layout';
import { usuariosService } from '../../services/usuarios.service';
import { auditoriaService } from '../../services/auditoria.service';
import { configuracoesService } from '../../services/configuracoes.service';
import { filiaisService } from '../../services/filiais.service';
import { comTimeout } from '../../utils/comTimeout';
import { formatarCPF, formatarCNPJ } from '../../utils/mascaras';
import { UFS } from '../../constants/roles';

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
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Criar contas, definir função e bloquear acesso.</p>
        </Link>
        <Link to="/auditoria" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🕵️</div>
          <h3 style={{ margin: '0 0 6px' }}>Auditoria</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Histórico de criação, alteração e exclusão no banco.</p>
        </Link>
        <Link to="/configuracoes" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏥</div>
          <h3 style={{ margin: '0 0 6px' }}>Configurações da Clínica</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Nome, endereço e telefone usados nos documentos impressos.</p>
        </Link>
        <Link to="/filiais" style={cardStyle}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏢</div>
          <h3 style={{ margin: '0 0 6px' }}>Filiais</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Cadastro de outras unidades, cada uma com sua própria logomarca.</p>
        </Link>
      </div>
    </div>
  );
}

export function UsuariosPage() {
  const [usuarios, setUsuarios] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [form, setForm] = React.useState({ nome: '', email: '', senha: '', confirmar: '', funcao: 'Médico', crm: '', uf: '', sexo: '', nascimento: '', cpf: '', especialidade: '', area_atuacao: '' });
  const [mostraSenha, setMostraSenha] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [editando, setEditando] = React.useState(null); // { id, nome, funcao, crm }
  const [salvandoEdicaoUsuario, setSalvandoEdicaoUsuario] = React.useState(false);
  const [processandoStatusId, setProcessandoStatusId] = React.useState(null);

  React.useEffect(() => {
    usuariosService.listar()
      .then(setUsuarios)
      .catch(err => console.error(err))
      .finally(() => setCarregando(false));
  }, []);

  const criarUsuario = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.senha !== form.confirmar) {
      setMsg({ tipo: 'erro', texto: 'As senhas não conferem.' });
      return;
    }
    if (form.senha.length < 6) {
      setMsg({ tipo: 'erro', texto: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    setSalvando(true);
    try {
      await comTimeout(usuariosService.criar({ nome: form.nome, email: form.email, senha: form.senha, funcao: form.funcao, crm: form.crm, uf: form.uf, sexo: form.sexo, nascimento: form.nascimento, cpf: form.cpf, especialidade: form.especialidade, area_atuacao: form.area_atuacao }));
      const lista = await comTimeout(usuariosService.listar());
      setUsuarios(lista);
      setForm({ nome: '', email: '', senha: '', confirmar: '', funcao: 'Médico', crm: '', uf: '', sexo: '', nascimento: '', cpf: '', especialidade: '', area_atuacao: '' });
      setMsg({ tipo: 'sucesso', texto: `Usuário "${form.nome}" criado com sucesso. Um e-mail de confirmação será enviado para ${form.email}.` });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async () => {
    if (!editando?.nome.trim()) return;
    setSalvandoEdicaoUsuario(true);
    try {
      await comTimeout(usuariosService.atualizar(editando.id, editando));
      setUsuarios(prev => prev.map(u => u.id === editando.id ? { ...u, ...editando } : u));
      setEditando(null);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
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
      alert('Erro ao alterar status: ' + err.message);
    } finally {
      setProcessandoStatusId(null);
    }
  };

  const funcaoIcone = { 'Médico': '👨‍⚕️', 'Enfermeiro(a)': '👩‍⚕️', 'Recepcionista': '💼', 'Financeiro': '💰', 'Administrador': '⚙️' };

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
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nome completo *</label>
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Dr. João Silva" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>E-mail *</label>
              <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@clinica.com" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Função</label>
              <select value={form.funcao} onChange={e => setForm({ ...form, funcao: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>
                <option>Médico</option>
                <option>Enfermeiro(a)</option>
                <option>Recepcionista</option>
                <option>Financeiro</option>
                <option>Administrador</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CRM <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>(médicos)</span></label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input value={form.crm} onChange={e => setForm({ ...form, crm: e.target.value.replace(/\D/g, '') })} placeholder="Número" inputMode="numeric" style={{ flex: 2, minWidth: 0, padding: '8px' }} />
                <select value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value })} style={{ flex: 1, minWidth: 0, padding: '8px', fontSize: '14px' }}>
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Sexo</label>
              <select value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>
                <option value="">Não informado</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data de nascimento</label>
              <input type="date" value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CPF</label>
              <input value={form.cpf} onChange={e => setForm({ ...form, cpf: formatarCPF(e.target.value) })} placeholder="000.000.000-00" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Especialidade médica</label>
              <input value={form.especialidade} onChange={e => setForm({ ...form, especialidade: e.target.value })} placeholder="Ex: Cardiologia" list="lista-especialidades" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Área de atuação</label>
              <input value={form.area_atuacao} onChange={e => setForm({ ...form, area_atuacao: e.target.value })} placeholder="Ex: Cardiologia Intervencionista" style={{ width: '100%', padding: '8px' }} />
            </div>
            <datalist id="lista-especialidades">
              {['Cardiologia','Clínica Médica','Endocrinologia','Gastroenterologia','Geriatria',
                'Ginecologia','Neurologia','Oftalmologia','Ortopedia','Pediatria',
                'Pneumologia','Psiquiatria','Reumatologia','Urologia'].map(e => <option key={e} value={e} />)}
            </datalist>
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Senha temporária *</label>
              <input required type={mostraSenha ? 'text' : 'password'} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="mín. 6 caracteres" style={{ width: '100%', padding: '8px', paddingRight: '72px' }} />
              <button type="button" onClick={() => setMostraSenha(!mostraSenha)} style={{ position: 'absolute', right: '4px', top: '29px', padding: '4px 8px', fontSize: '11px', background: '#f3f4f6', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}>
                {mostraSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Confirmar senha *</label>
              <input required type={mostraSenha ? 'text' : 'password'} value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} placeholder="repita a senha" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', backgroundColor: msg.tipo === 'sucesso' ? '#d1fae5' : '#fee2e2', color: msg.tipo === 'sucesso' ? '#065f46' : '#991b1b', fontSize: '14px' }}>
              {msg.tipo === 'sucesso' ? '✓ ' : '⚠ '}{msg.texto}
            </div>
          )}

          <button type="submit" disabled={salvando} style={{ padding: '10px 20px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Criando...' : '+ Criar Usuário'}
          </button>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6b7280' }}>
            * Informe a senha temporária ao novo usuário. Ele precisará confirmar o e-mail antes de fazer o primeiro login.
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
                      <div style={{ fontWeight: '600', fontSize: '15px', color: '#111' }}>{u.nome}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{u.email}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        {u.funcao}{u.crm ? ` · CRM ${u.crm}${u.uf ? '/' + u.uf : ''}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '10px', backgroundColor: u.ativo ? '#d1fae5' : '#fee2e2', color: u.ativo ? '#065f46' : '#991b1b', fontWeight: '500' }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <button onClick={() => setEditando({ id: u.id, nome: u.nome, funcao: u.funcao, crm: u.crm || '', uf: u.uf || '', sexo: u.sexo || '', nascimento: u.nascimento || '', cpf: u.cpf || '', especialidade: u.especialidade || '', area_atuacao: u.area_atuacao || '' })} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>
                        ✎ Editar
                      </button>
                      <button
                        onClick={() => alterarStatus(u.id, u.ativo)}
                        disabled={processandoStatusId === u.id}
                        style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: u.ativo ? '#fee2e2' : '#d1fae5', color: u.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: processandoStatusId === u.id ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: processandoStatusId === u.id ? 0.6 : 1 }}
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
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Nome</label>
                        <input value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Função</label>
                        <select value={editando.funcao} onChange={e => setEditando({ ...editando, funcao: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
                          <option>Médico</option>
                          <option>Enfermeiro(a)</option>
                          <option>Recepcionista</option>
                          <option>Financeiro</option>
                          <option>Administrador</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>CRM</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input value={editando.crm || ''} onChange={e => setEditando({ ...editando, crm: e.target.value.replace(/\D/g, '') })} placeholder="Número" inputMode="numeric" style={{ flex: 2, minWidth: 0, padding: '7px', fontSize: '13px' }} />
                          <select value={editando.uf || ''} onChange={e => setEditando({ ...editando, uf: e.target.value })} style={{ flex: 1, minWidth: 0, padding: '7px', fontSize: '13px' }}>
                            <option value="">UF</option>
                            {UFS.map(uf => <option key={uf}>{uf}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Sexo</label>
                        <select value={editando.sexo || ''} onChange={e => setEditando({ ...editando, sexo: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '13px' }}>
                          <option value="">Não informado</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Data de nascimento</label>
                        <input type="date" value={editando.nascimento || ''} onChange={e => setEditando({ ...editando, nascimento: e.target.value })} style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>CPF</label>
                        <input value={editando.cpf || ''} onChange={e => setEditando({ ...editando, cpf: formatarCPF(e.target.value) })} placeholder="000.000.000-00" style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Especialidade médica</label>
                        <input value={editando.especialidade || ''} onChange={e => setEditando({ ...editando, especialidade: e.target.value })} placeholder="Ex: Cardiologia" list="lista-especialidades" style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Área de atuação</label>
                        <input value={editando.area_atuacao || ''} onChange={e => setEditando({ ...editando, area_atuacao: e.target.value })} placeholder="Ex: Cardiologia Intervencionista" style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                      E-mail: <strong>{u.email}</strong> <span style={{ color: '#9ca3af' }}>(não editável)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={salvarEdicao} disabled={salvandoEdicaoUsuario} style={{ padding: '7px 16px', backgroundColor: salvandoEdicaoUsuario ? '#9ca3af' : '#0369a1', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoEdicaoUsuario ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                        {salvandoEdicaoUsuario ? 'Salvando...' : '✓ Salvar'}
                      </button>
                      <button onClick={() => setEditando(null)} style={{ padding: '7px 12px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
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
};

const ROTULOS_OPERACAO = {
  INSERT: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
};

export function AuditoriaPage() {
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
      <p style={{ color: '#666', fontSize: '14px', marginTop: '-8px' }}>
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
                <div style={{ fontSize: '14px' }}>
                  <strong>{ROTULOS_OPERACAO[ev.operacao] || ev.operacao}</strong>
                  {' — '}{ROTULOS_TABELA[ev.tabela] || ev.tabela}
                  <span style={{ color: '#888' }}> · {nomeUsuario(ev.alterado_por)}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {new Date(ev.alterado_em).toLocaleString('pt-BR')}
                </div>
              </div>

              {expandido === ev.id && (
                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#888' }}>ANTES</strong>
                    <pre style={{ fontSize: '11px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '260px' }}>
                      {ev.dados_antigos ? JSON.stringify(ev.dados_antigos, null, 2) : '—'}
                    </pre>
                  </div>
                  <div>
                    <strong style={{ fontSize: '12px', color: '#888' }}>DEPOIS</strong>
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
    </div>
  );
}

// Mostra um campo em modo leitura (fora de edição) — mesmo rótulo do
// modo edição, só que como texto simples em vez de input.
function CampoVisualizacao({ label, valor }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>{label}</div>
      <div style={{ fontSize: '14px', color: valor ? '#111827' : '#9ca3af' }}>{valor || 'Não informado'}</div>
    </div>
  );
}

export function ConfiguracoesClinicaPage() {
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
      alert('Erro ao enviar logomarca: ' + err.message);
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
  const labelStyle = { fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  return (
    <div>
      <Header />
      <Link to="/painel">← Voltar ao Painel</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
        <h2 style={{ margin: 0 }}>Configurações da Clínica</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/filiais" style={{ padding: '8px 14px', fontSize: '13px', textDecoration: 'none', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px' }}>
            🏢 Filiais
          </Link>
          {!editando && (
            <button onClick={() => setEditando(true)} style={{ padding: '8px 14px', fontSize: '13px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✏️ Editar
            </button>
          )}
        </div>
      </div>
      <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
        Toda alteração fica registrada na Auditoria, com data e quem editou.
      </p>

      {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

      <form onSubmit={salvar}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

          {/* Logomarca, nome, nome fantasia, CNPJ */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ marginTop: 0 }}>Logomarca</h3>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <div style={{ width: '220px', height: '220px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} alt="Logomarca da clínica" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '13px', color: '#9ca3af' }}>sem logo</span>}
              </div>
            </div>
            {editando && (
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <input type="file" accept="image/*" onChange={enviarLogo} disabled={enviandoLogo} style={{ fontSize: '13px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9ca3af' }}>Prefira uma imagem quadrada em boa resolução.</p>
                {enviandoLogo && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>Enviando...</p>}
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

            <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#9ca3af' }}>
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
                {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo!</span>}
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
      alert('Erro ao enviar logomarca: ' + err.message);
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
      alert('Erro ao alterar status: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const campoStyle = { width: '100%', padding: '8px' };
  const labelStyle = { fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

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

      {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

      {mostrarForm && (
        <form onSubmit={salvar} style={{ marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0 }}>Logomarca</h3>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <div style={{ width: '220px', height: '220px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {form.logoUrl
                    ? <img src={form.logoUrl} alt="Logomarca da filial" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '13px', color: '#9ca3af' }}>sem logo</span>}
                </div>
              </div>
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <input type="file" accept="image/*" onChange={enviarLogo} disabled={enviandoLogo} style={{ fontSize: '13px' }} />
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9ca3af' }}>Prefira uma imagem quadrada em boa resolução.</p>
                {enviandoLogo && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>Enviando...</p>}
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
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {[filial.cidade, filial.telefone].filter(Boolean).join(' · ') || 'Endereço e telefone não informados'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => editarFilial(filial)} style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>
                  Editar
                </button>
                <button
                  onClick={() => alternarAtivo(filial)}
                  disabled={processandoId === filial.id}
                  style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: filial.ativo ? '#fee2e2' : '#d1fae5', color: filial.ativo ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '4px', cursor: processandoId === filial.id ? 'not-allowed' : 'pointer' }}
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

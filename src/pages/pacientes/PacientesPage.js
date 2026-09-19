import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { pacientesService } from '../../services/pacientes.service';
import { conveniosService } from '../../services/convenios.service';
import { comTimeout } from '../../utils/comTimeout';
import { dataBrasileiraParaISO, formatarData, formatarDataDigitada, formatarCPF } from '../../utils/mascaras';
import { FUNCOES_CLINICAS } from '../../constants/roles';

export function PacientesPage({ pacientes, setPacientes }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { funcao } = useAuth();
  const podeVerProntuario = FUNCOES_CLINICAS.includes(funcao);

  const [busca, setBusca] = React.useState('');
  const [pacienteEditando, setPacienteEditando] = React.useState(null);
  const [salvandoPaciente, setSalvandoPaciente] = React.useState(false);
  const [processandoId, setProcessandoId] = React.useState(null);
  const [convenios, setConvenios] = React.useState([]);

  React.useEffect(() => {
    conveniosService.listar().then(setConvenios).catch(() => {});
  }, []);

  const limparCPF = (cpf) => (cpf || '').replace(/\D/g, '');

  const formatarTelefone = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 11);
    if (n.length === 0) return '';
    if (n.length <= 2) return `(${n}`;
    if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  const formatarCEP = (valor) => {
    const n = valor.replace(/\D/g, '').slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  const formatarEnderecoCompleto = (paciente) => {
    const enderecoNumero = [paciente.endereco, paciente.numero ? `nº ${paciente.numero}` : '']
      .filter(Boolean)
      .join(', ');
    return [enderecoNumero, paciente.complemento].filter(Boolean).join(' — ') || '-';
  };

  const buscarCEP = async (cepFormatado) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const partes = [data.logradouro, data.bairro, data.localidade].filter(Boolean);
        const endereco = `${partes.join(', ')} - ${data.uf}`;
        setNovoPaciente(prev => ({ ...prev, endereco }));
      }
    } catch (_) {}
  };

  const [novoPaciente, setNovoPaciente] = React.useState({
    nome: '',
    cpf: '',
    nascimento: '',
    nomeMae: '',
    telefone: '',
    convenioId: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: ''
  });

  const pacientesFiltrados = pacientes
    .filter((paciente) =>
      (paciente.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (paciente.cpf || '').includes(busca) ||
      (paciente.nascimento || '').includes(busca) ||
      (paciente.nomeMae || '').toLowerCase().includes(busca.toLowerCase())
    )
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const limparFormulario = () => {
    setNovoPaciente({
      nome: '',
      cpf: '',
      nascimento: '',
      nomeMae: '',
      telefone: '',
      convenioId: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: ''
    });
    setPacienteEditando(null);
  };

  const salvarPaciente = async () => {
    const nascimentoISO = novoPaciente.nascimento
      ? dataBrasileiraParaISO(novoPaciente.nascimento)
      : '';
    if (novoPaciente.nascimento && !nascimentoISO) {
      toast.warning('Informe uma data de nascimento válida no formato DD/MM/AAAA.');
      return;
    }

    const temIdentificador =
      novoPaciente.cpf || nascimentoISO || novoPaciente.nomeMae;

    if (!novoPaciente.nome || !temIdentificador || !novoPaciente.telefone) {
      toast.warning('Preencha o nome do paciente, telefone e pelo menos um destes dados: CPF, data de nascimento ou nome da mãe.');
      return;
    }

    const cpfAtual = limparCPF(novoPaciente.cpf);
    if (cpfAtual) {
      const cpfDuplicado = pacientes.some((p) =>
        limparCPF(p.cpf) === cpfAtual && p.id !== pacienteEditando?.id
      );
      if (cpfDuplicado) {
        toast.warning('Já existe um paciente cadastrado com este CPF.');
        return;
      }
    }

    setSalvandoPaciente(true);
    try {
      const dadosParaSalvar = { ...novoPaciente, nascimento: nascimentoISO };
      if (pacienteEditando) {
        const atualizado = await comTimeout(pacientesService.atualizarCadastro(pacienteEditando.id, dadosParaSalvar));
        setPacientes(pacientes.map((p) =>
          p.id === pacienteEditando.id ? { ...p, ...atualizado, registros: p.registros } : p
        ));
      } else {
        const criado = await comTimeout(pacientesService.criar(dadosParaSalvar));
        setPacientes([...pacientes, { ...criado, registros: [] }]);
      }
      limparFormulario();
    } catch (err) {
      if (err.code === '23505') {
        toast.warning('Já existe um paciente cadastrado com este CPF (inclusive entre os desativados).');
      } else if (
        err.code === 'PGRST204'
        && /'(numero|complemento)' column of 'pacientes'/.test(err.message || '')
      ) {
        toast.error('O banco de dados ainda não recebeu a atualização dos campos Número e Complemento. Aplique a migração pendente e tente novamente.');
      } else {
        toast.error('Erro ao salvar paciente: ' + err.message);
      }
    } finally {
      setSalvandoPaciente(false);
    }
  };

  const desativarPaciente = async (paciente) => {
    const confirmado = window.confirm(
      `Desativar o cadastro de "${paciente.nome}"?\n\nO paciente sai da lista e das buscas, mas o histórico dele no prontuário é mantido. Isso não é uma exclusão definitiva, mas hoje só é revertida diretamente no banco de dados.`
    );
    if (!confirmado) return;
    setProcessandoId(paciente.id);
    try {
      await comTimeout(pacientesService.deletar(paciente.id));
      setPacientes(pacientes.filter((p) => p.id !== paciente.id));
    } catch (err) {
      toast.error('Erro ao desativar paciente: ' + err.message);
    } finally {
      setProcessandoId(null);
    }
  };

  const editarPaciente = (paciente) => {
    setPacienteEditando(paciente);

    setNovoPaciente({
      nome: paciente.nome || '',
      cpf: paciente.cpf || '',
      nascimento: paciente.nascimento ? formatarData(paciente.nascimento) : '',
      nomeMae: paciente.nomeMae || '',
      telefone: paciente.telefone || '',
      convenioId: paciente.convenioId || '',
      cep: paciente.cep || '',
      endereco: paciente.endereco || '',
      numero: paciente.numero || '',
      complemento: paciente.complemento || ''
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <Header />

      <h2>Cadastro de Pacientes</h2>

      <div
        style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          position: 'sticky',
          top: '0',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {pacienteEditando ? 'Editar Paciente' : 'Novo Paciente'}
        </h3>

        <div className="form-grid-paciente">
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 4' }}>
            <span>Nome completo *</span>
            <input
              placeholder="Digite o nome completo"
              value={novoPaciente.nome}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, nome: e.target.value })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 2' }}>
            <span>CPF</span>
            <input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={novoPaciente.cpf}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, cpf: formatarCPF(e.target.value) })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 2' }}>
            <span>Data de nascimento</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              placeholder="DD/MM/AAAA"
              aria-label="Data de nascimento"
              value={novoPaciente.nascimento}
              onChange={(e) => {
                const removendo = e.target.value.length < novoPaciente.nascimento.length;
                setNovoPaciente({
                  ...novoPaciente,
                  nascimento: formatarDataDigitada(e.target.value, !removendo),
                });
              }}
              maxLength={10}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 4' }}>
            <span>Nome da mãe</span>
            <input
              placeholder="Digite o nome da mãe"
              value={novoPaciente.nomeMae}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, nomeMae: e.target.value })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 2' }}>
            <span>Telefone *</span>
            <input
              inputMode="tel"
              placeholder="(XX) XXXXX-XXXX"
              value={novoPaciente.telefone}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, telefone: formatarTelefone(e.target.value) })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 2' }}>
            <span>CEP</span>
            <input
              inputMode="numeric"
              placeholder="00000-000"
              value={novoPaciente.cep}
              onChange={(e) => {
                const cepFormatado = formatarCEP(e.target.value);
                setNovoPaciente(prev => ({ ...prev, cep: cepFormatado }));
                buscarCEP(cepFormatado);
              }}
              maxLength={9}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 5' }}>
            <span>Endereço</span>
            <input
              placeholder="Preenchido automaticamente pelo CEP"
              value={novoPaciente.endereco}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, endereco: e.target.value })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 1' }}>
            <span>Número</span>
            <input
              placeholder="123"
              value={novoPaciente.numero}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, numero: e.target.value })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 2' }}>
            <span>Complemento</span>
            <input
              placeholder="Apto, bloco..."
              value={novoPaciente.complemento}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, complemento: e.target.value })}
            />
          </label>
          <label className="campo-cadastro-paciente" style={{ gridColumn: 'span 12' }}>
            <span>Convênio</span>
            <select
              value={novoPaciente.convenioId}
              onChange={(e) => setNovoPaciente({ ...novoPaciente, convenioId: e.target.value })}
            >
              <option value="">Selecione um convênio</option>
              {convenios.filter(c => c.ativo).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <button
            onClick={salvarPaciente}
            disabled={salvandoPaciente}
            style={{ padding: '12px', backgroundColor: salvandoPaciente ? '#9ca3af' : (pacienteEditando ? '#f59e0b' : '#28a745'), color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoPaciente ? 'not-allowed' : 'pointer', gridColumn: 'span 12' }}
          >
            {salvandoPaciente ? 'Salvando...' : (pacienteEditando ? 'Salvar Alterações' : 'Salvar Paciente')}
          </button>
          {pacienteEditando && (
            <button
              onClick={limparFormulario}
              style={{ padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 12' }}
            >
              Cancelar Edição
            </button>
          )}
        </div>

        <p className="field-note" style={{ color: '#666', margin: '10px 0 0' }}>
          * Obrigatório: nome, telefone e pelo menos CPF, data de nascimento ou nome da mãe.
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px'
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: pacienteEditando ? '255px' : '205px',
            zIndex: 15,
            backgroundColor: 'white',
            padding: '10px 0 15px',
            borderBottom: '1px solid #eee'
          }}
        >
          <h3 style={{ marginTop: 0 }}>Lista de Pacientes</h3>

          <input
            placeholder="Buscar por nome, CPF, data de nascimento ou nome da mãe..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '18px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginTop: '15px', display: 'grid', gap: '8px' }}>
          {pacientesFiltrados.length === 0 ? (
            <p>Nenhum paciente encontrado.</p>
          ) : (
            pacientesFiltrados.map((paciente) => (
              <div
                key={paciente.id}
                style={{
                  border: '1px solid #ddd',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div className="paciente-row-1">
                  <div>
                    <strong>{paciente.nome}</strong>
                    <div style={{ fontSize: '16px', color: '#666' }}>
                      Mãe: {paciente.nomeMae || 'Não informado'}
                    </div>
                  </div>

                  <div style={{ fontSize: '16px' }}>
                    <strong>CPF:</strong><br />
                    {paciente.cpf || '-'}
                  </div>

                  <div style={{ fontSize: '16px' }}>
                    <strong>Nasc.:</strong><br />
                    {formatarData(paciente.nascimento)}
                  </div>

                  <div style={{ fontSize: '16px' }}>
                    <strong>Tel.:</strong><br />
                    {paciente.telefone || '-'}
                  </div>
                </div>

                <div className="paciente-row-2">
                  <div>
                    <strong>Convênio:</strong> {paciente.convenio || '-'}
                  </div>

                  <div>
                    <strong>Endereço:</strong> {formatarEnderecoCompleto(paciente)}
                  </div>

                </div>

                <div style={{ marginTop: '8px' }}>
                  {podeVerProntuario && (
                    <button
                      onClick={() => navigate(`/prontuario/${paciente.id}`)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '8px'
                      }}
                    >
                      Abrir Prontuário
                    </button>
                  )}

                  <button
                    onClick={() => editarPaciente(paciente)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Editar Cadastro
                  </button>

                  <button
                    onClick={() => desativarPaciente(paciente)}
                    disabled={processandoId === paciente.id}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      cursor: processandoId === paciente.id ? 'not-allowed' : 'pointer',
                      opacity: processandoId === paciente.id ? 0.6 : 1
                    }}
                  >
                    {processandoId === paciente.id ? 'Desativando...' : 'Desativar'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

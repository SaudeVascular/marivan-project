import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Layout';
import { SENHA_MINIMO_CARACTERES, validarSenha } from '../../constants/security';
import { authService } from '../../services/authService';
import { usuariosService } from '../../services/usuarios.service';
import { comTimeout } from '../../utils/comTimeout';
import { PasswordInput } from '../../components/common/PasswordInput';
import { AssinaturaDigital } from '../../components/common/AssinaturaDigital';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/common/Toast';

export function MinhaContaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, perfil, temAcessoClinico } = useAuth();
  const [senhaAtual, setSenhaAtual] = React.useState('');
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  // Estado local em vez de recarregar o perfil inteiro do contexto — o
  // mesmo padrão já usado em AdministracaoPages para refletir a mudança
  // na tela na hora, sem depender de um mecanismo de refetch do useAuth.
  const [assinatura, setAssinatura] = React.useState(perfil?.assinatura_imagem || null);
  const [salvandoAssinatura, setSalvandoAssinatura] = React.useState(false);

  React.useEffect(() => { setAssinatura(perfil?.assinatura_imagem || null); }, [perfil?.assinatura_imagem]);

  const salvarAssinatura = async (dataUri) => {
    setSalvandoAssinatura(true);
    try {
      await comTimeout(usuariosService.salvarAssinatura(user.id, dataUri));
      setAssinatura(dataUri);
      toast.success('Assinatura salva.');
    } catch (err) {
      toast.error('Não foi possível salvar a assinatura: ' + err.message);
    } finally {
      setSalvandoAssinatura(false);
    }
  };

  const removerAssinatura = async () => {
    setSalvandoAssinatura(true);
    try {
      await comTimeout(usuariosService.removerAssinatura(user.id));
      setAssinatura(null);
      toast.success('Assinatura removida.');
    } catch (err) {
      toast.error('Não foi possível remover a assinatura: ' + err.message);
    } finally {
      setSalvandoAssinatura(false);
    }
  };

  const alterarSenha = async (event) => {
    event.preventDefault();
    setErro('');
    if (senhaAtual === novaSenha) return setErro('A nova senha deve ser diferente da senha atual.');
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) return setErro(erroSenha);
    if (novaSenha !== confirmacao) return setErro('As senhas não coincidem.');

    setSalvando(true);
    try {
      await comTimeout(authService.changePassword(senhaAtual, novaSenha));
      navigate('/login', { replace: true });
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <Header />
      <div style={{ maxWidth: '460px', margin: '30px auto', backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0 }}>Minha conta</h2>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Após a alteração, todas as sessões serão encerradas e será necessário entrar novamente.</p>
        <form onSubmit={alterarSenha}>
          {erro && <p style={{ color: '#dc2626', fontSize: '16px' }}>{erro}</p>}
          <PasswordInput label="Senha atual" containerStyle={{ marginBottom: '14px' }} required autoComplete="current-password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
          <PasswordInput label="Nova senha" containerStyle={{ marginBottom: '14px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
          <PasswordInput label="Confirmar nova senha" containerStyle={{ marginBottom: '20px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
          <button type="submit" disabled={salvando} style={{ width: '100%', padding: '12px', backgroundColor: salvando ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>

      {/* Só quem assina documento (funções clínicas, ou Administrador
          com papel clínico concedido) precisa disso. */}
      {temAcessoClinico && (
        <div style={{ maxWidth: '520px', margin: '20px auto', backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0 }}>Assinatura digitalizada</h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            Usada nos documentos impressos (atestado, receituário, relatório...), acima do seu nome, no lugar
            da linha em branco. Sem uma assinatura salva, os documentos continuam saindo com a linha em
            branco de sempre, para assinar à mão no papel.
          </p>
          <AssinaturaDigital
            valorAtual={assinatura}
            salvando={salvandoAssinatura}
            onSalvar={salvarAssinatura}
            onRemover={removerAssinatura}
          />
        </div>
      )}
    </div>
  );
}

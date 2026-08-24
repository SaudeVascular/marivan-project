import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Layout';
import { SENHA_MINIMO_CARACTERES, validarSenha } from '../../constants/security';
import { authService } from '../../services/authService';
import { comTimeout } from '../../utils/comTimeout';
import { PasswordInput } from '../../components/common/PasswordInput';

export function MinhaContaPage() {
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = React.useState('');
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

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
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Após a alteração, todas as sessões serão encerradas e será necessário entrar novamente.</p>
        <form onSubmit={alterarSenha}>
          {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}
          <PasswordInput label="Senha atual" containerStyle={{ marginBottom: '14px' }} required autoComplete="current-password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
          <PasswordInput label="Nova senha" containerStyle={{ marginBottom: '14px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
          <PasswordInput label="Confirmar nova senha" containerStyle={{ marginBottom: '20px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
          <button type="submit" disabled={salvando} style={{ width: '100%', padding: '12px', backgroundColor: salvando ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

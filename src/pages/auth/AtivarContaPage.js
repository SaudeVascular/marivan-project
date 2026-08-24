import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SENHA_MINIMO_CARACTERES, validarSenha } from '../../constants/security';
import { authService } from '../../services/authService';
import { comTimeout } from '../../utils/comTimeout';
import { PasswordInput } from '../../components/common/PasswordInput';

export function AtivarContaPage() {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [estadoLink, setEstadoLink] = React.useState('validando');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState(false);

  React.useEffect(() => {
    let montado = true;
    authService.getLinkSession('invite')
      .then((session) => {
        if (montado) setEstadoLink(session ? 'valido' : 'invalido');
      })
      .catch(() => {
        if (montado) setEstadoLink('invalido');
      });
    return () => { montado = false; };
  }, []);

  const ativar = async (event) => {
    event.preventDefault();
    setErro('');
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) return setErro(erroSenha);
    if (novaSenha !== confirmacao) return setErro('As senhas não coincidem.');

    setSalvando(true);
    try {
      await comTimeout(authService.updatePassword(novaSenha));
      setSucesso(true);
    } catch (err) {
      if (/session missing|token|expired|expir/i.test(err.message || '')) {
        setEstadoLink('invalido');
      } else {
        setErro(err.message || 'Não foi possível ativar a conta.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '80px auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0 }}>Ativar minha conta</h2>

      {estadoLink === 'validando' ? (
        <p style={{ color: '#6b7280' }}>Validando o convite...</p>
      ) : estadoLink === 'invalido' ? (
        <>
          <p style={{ color: '#dc2626' }}>Este convite é inválido, já foi utilizado ou expirou.</p>
          <button onClick={() => navigate('/login', { replace: true })} style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Voltar ao login
          </button>
        </>
      ) : sucesso ? (
        <>
          <p style={{ color: '#059669' }}>Conta ativada e senha definida com segurança.</p>
          <button onClick={() => navigate('/login', { replace: true })} style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Fazer login
          </button>
        </>
      ) : (
        <form onSubmit={ativar}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Crie sua senha pessoal. Ela não será conhecida pelo administrador.</p>
          {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}
          <PasswordInput label="Nova senha" containerStyle={{ marginBottom: '14px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
          <PasswordInput label="Confirmar nova senha" containerStyle={{ marginBottom: '20px' }} required minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
          <button type="submit" disabled={salvando} style={{ width: '100%', padding: '12px', backgroundColor: salvando ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'Ativando...' : 'Definir senha e ativar'}
          </button>
        </form>
      )}
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { comTimeout } from '../../utils/comTimeout';
import { SENHA_MINIMO_CARACTERES, validarSenha } from '../../constants/security';

export function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState(false);
  const [estadoLink, setEstadoLink] = React.useState('validando');

  React.useEffect(() => {
    let montado = true;
    authService.getRecoverySession()
      .then((session) => {
        if (montado) setEstadoLink(session ? 'valido' : 'invalido');
      })
      .catch(() => {
        if (montado) setEstadoLink('invalido');
      });
    return () => { montado = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) {
      setErro(erroSenha);
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setSalvando(true);
    try {
      await comTimeout(authService.updatePassword(novaSenha));
      setSucesso(true);
    } catch (err) {
      if (/session missing|token|expired|expir/i.test(err.message || '')) {
        setEstadoLink('invalido');
      } else {
        setErro(err.message || 'Erro ao redefinir a senha.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '80px auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0 }}>Definir nova senha</h2>

      {estadoLink === 'validando' ? (
        <p style={{ color: '#6b7280' }}>Validando o link de recuperação...</p>
      ) : estadoLink === 'invalido' ? (
        <>
          <p style={{ color: '#dc2626' }}>Este link é inválido, já foi utilizado ou expirou.</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Solicitar um novo link
          </button>
        </>
      ) : sucesso ? (
        <>
          <p style={{ color: '#059669' }}>Senha redefinida. Todas as sessões anteriores foram encerradas.</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Fazer login novamente
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Nova senha</label>
            <input type="password" minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Confirmar nova senha</label>
            <input type="password" minLength={SENHA_MINIMO_CARACTERES} autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
          </div>
          <button
            type="submit"
            disabled={salvando}
            style={{ width: '100%', padding: '12px', backgroundColor: salvando ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer' }}
          >
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}

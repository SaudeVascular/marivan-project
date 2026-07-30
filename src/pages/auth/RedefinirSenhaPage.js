import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { comTimeout } from '../../utils/comTimeout';

export function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmacao, setConfirmacao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [sucesso, setSucesso] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
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
      setErro(err.message || 'Erro ao redefinir a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '80px auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0 }}>Definir nova senha</h2>

      {sucesso ? (
        <>
          <p style={{ color: '#059669' }}>Senha redefinida com sucesso.</p>
          <button
            onClick={() => navigate('/pacientes')}
            style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Ir para o sistema
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Nova senha</label>
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Confirmar nova senha</label>
            <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
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

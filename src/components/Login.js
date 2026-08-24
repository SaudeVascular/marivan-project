// src/components/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { comTimeout } from '../utils/comTimeout';
import { consumirMotivoLogout, MOTIVO_INATIVIDADE } from '../utils/sessionSecurity';
import { PasswordInput } from './common/PasswordInput';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() =>
    consumirMotivoLogout() === MOTIVO_INATIVIDADE
      ? 'Sua sessão foi encerrada após 15 minutos de inatividade.'
      : ''
  );
  const [modo, setModo] = useState('login'); // 'login' | 'recuperar'
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await comTimeout(login(email, password));
      navigate('/');
    } catch (err) {
      setError('Não foi possível entrar. Verifique o e-mail e a senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await comTimeout(authService.resetPassword(email));
      setRecuperarEnviado(true);
    } catch (err) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (modo === 'recuperar') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '40px',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px' }}>
            Recuperar senha
          </h1>

          {recuperarEnviado ? (
            <>
              <p style={{ fontSize: '14px', color: '#374151', margin: '16px 0' }}>
                Se houver uma conta cadastrada com o e-mail <strong>{email}</strong>, enviamos um link para redefinir a senha.
              </p>
              <button
                type="button"
                onClick={() => { setModo('login'); setRecuperarEnviado(false); }}
                style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: 'pointer' }}
              >
                Voltar para o login
              </button>
            </>
          ) : (
            <form onSubmit={handleRecuperar}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 20px' }}>
                Digite seu e-mail de acesso. Enviaremos um link para redefinir a senha.
              </p>

              {error && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: '14px' }}>{error}</span>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  style={{ width: '100%', padding: '12px', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px' }}
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button
                type="button"
                onClick={() => setModo('login')}
                style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', fontSize: '14px', cursor: 'pointer' }}
              >
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Logo e Título */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#dbeafe',
            marginBottom: '20px'
          }}>
            <Activity style={{ 
              color: '#3b82f6', 
              width: '40px', 
              height: '40px' 
            }} />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 8px'
          }}>
            Prontuário Eletrônico
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Faça login para continuar
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          {/* Mensagem de erro */}
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#dc2626'
            }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: '14px' }}>{error}</span>
            </div>
          )}

          {/* Campo Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                width: '20px',
                height: '20px'
              }} />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{
                  width: '100%',
                  paddingLeft: '44px',
                  paddingRight: '12px',
                  paddingTop: '12px',
                  paddingBottom: '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          </div>

          {/* Campo Senha */}
          <PasswordInput
            label="Senha"
            containerStyle={{ marginBottom: '24px' }}
            labelStyle={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}
            icon={<Lock style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                width: '20px',
                height: '20px'
              }} />}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            inputStyle={{
              paddingLeft: '44px',
              paddingTop: '12px',
              paddingBottom: '12px',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />

          {/* Botão de Login */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#2563eb')}
            onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#3b82f6')}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => { setError(''); setModo('recuperar'); }}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '8px',
              backgroundColor: 'transparent',
              color: '#3b82f6',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Esqueci minha senha
          </button>
        </form>

        {/* Informações adicionais */}
        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            Em caso de problemas, contate o administrador
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

import React from 'react';

const ToastContext = React.createContext(null);

const CORES = {
  error:   { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icone: '⚠' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icone: '⚠' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icone: '✓' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icone: 'ℹ' },
};

// Erro fica mais tempo na tela — normalmente exige uma ação do usuário
// (revisar conexão, tentar de novo); aviso/sucesso são mais rápidos de ler.
const DURACAO_MS = { error: 8000, warning: 6000, success: 4000, info: 5000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const remover = React.useCallback((id) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const mostrar = React.useCallback((tipo, mensagem) => {
    const id = Date.now() + Math.random();
    setToasts((atual) => [...atual, { id, tipo, mensagem }]);
    setTimeout(() => remover(id), DURACAO_MS[tipo] || 5000);
  }, [remover]);

  const toast = React.useMemo(() => ({
    error:   (msg) => mostrar('error', msg),
    warning: (msg) => mostrar('warning', msg),
    success: (msg) => mostrar('success', msg),
    info:    (msg) => mostrar('info', msg),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed', top: '16px', right: '16px', zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px',
        }}
      >
        {toasts.map(({ id, tipo, mensagem }) => {
          const cor = CORES[tipo] || CORES.info;
          return (
            <div
              key={id}
              role="alert"
              style={{
                backgroundColor: cor.bg, border: `1px solid ${cor.border}`, color: cor.text,
                borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}
            >
              <span>{cor.icone}</span>
              <span style={{ flex: 1 }}>{mensagem}</span>
              <button
                onClick={() => remover(id)}
                aria-label="Fechar"
                style={{ background: 'none', border: 'none', color: cor.text, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

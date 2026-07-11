import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../services/supabase';
import { usuariosService } from '../services/usuarios.service';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  // Busca (e garante que existe) o perfil/função do usuário logado. Se a
  // conta foi desativada por um administrador, encerra a sessão aqui —
  // hoje uma conta com ativo=false continuava logada normalmente.
  const carregarPerfil = useCallback(async (authUser) => {
    if (!authUser) {
      setPerfil(null);
      return;
    }
    await usuariosService.garantirPerfil(authUser).catch(() => {});
    const p = await usuariosService.buscarPerfil(authUser.id).catch(() => null);
    if (p && p.ativo === false) {
      await supabase.auth.signOut();
      setUser(null);
      setPerfil(null);
      return;
    }
    setPerfil(p);
  }, []);

  useEffect(() => {
    // Verificar sessão atual
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      await carregarPerfil(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        await carregarPerfil(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [carregarPerfil]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, perfil, funcao: perfil?.funcao ?? null, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
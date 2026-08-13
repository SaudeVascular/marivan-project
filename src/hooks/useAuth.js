import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { supabase } from '../services/supabase';
import { usuariosService } from '../services/usuarios.service';
import { comTimeout } from '../utils/comTimeout';
import { limparRascunhosAtendimento } from '../utils/rascunhoAtendimento';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  // Só fica true quando temos uma resposta definitiva pro usuário atual —
  // ver comentário em carregarPerfil sobre por que isto existe.
  const [perfilPronto, setPerfilPronto] = useState(false);
  const [loading, setLoading] = useState(true);
  const ultimoUserIdRef = useRef(undefined);

  // Busca o perfil/função do usuário logado. A criação do perfil é
  // responsabilidade exclusiva do trigger do banco; o cliente não pode
  // criar o próprio perfil escolhendo uma função. Se a
  // conta foi desativada por um administrador, encerra a sessão aqui —
  // hoje uma conta com ativo=false continuava logada normalmente.
  //
  // Reload/troca de aba fazem o Supabase disparar mais de um evento de
  // auth quase junto (ex: "SIGNED_IN" e depois "INITIAL_SESSION"), cada
  // um chamando isto pro MESMO usuário. A primeira chamada corre contra
  // o cliente do Supabase ainda terminando de restaurar a sessão
  // internamente (mesmo lock interno pra todas as chamadas) e pode
  // estourar o timeout mesmo pra quem tem perfil normal — as chamadas
  // seguintes, feitas já com o cliente destravado, resolvem rápido e
  // certas. Por isso: um timeout aqui NÃO conta como resposta definitiva
  // (não marca `perfilPronto`, não sobrescreve `perfil`) — só uma leitura
  // que de fato voltou do banco conta. Sem essa distinção, os guards de
  // rota (SomenteAdmin etc.) veem funcao=null nesse intervalo e mandam
  // pra /pacientes mesmo quando o usuário tem a permissão certa.
  const carregarPerfil = useCallback(async (authUser) => {
    const authUserId = authUser?.id ?? null;
    if (authUserId !== ultimoUserIdRef.current) {
      ultimoUserIdRef.current = authUserId;
      setPerfilPronto(false);
    }
    if (!authUser) {
      setPerfil(null);
      setPerfilPronto(true);
      return;
    }
    let p;
    try {
      p = await comTimeout(usuariosService.buscarPerfil(authUser.id));
    } catch {
      return; // inconclusivo — deixa uma chamada seguinte decidir de verdade
    }
    if (p && p.ativo === false) {
      await supabase.auth.signOut();
      limparRascunhosAtendimento();
      setUser(null);
      setPerfil(null);
      setPerfilPronto(true);
      return;
    }
    setPerfil(p);
    setPerfilPronto(true);
  }, []);

  useEffect(() => {
    // Verificar sessão atual — com teto de tempo: sem isso, se o lock
    // interno de sessão do Supabase demorar (ex: renovação de token
    // presa), a tela fica presa em "Carregando pacientes..." (App.js)
    // sem limite algum. `onAuthStateChange` abaixo ainda recebe o
    // resultado real quando ele chegar, então isto é só uma rede de
    // segurança pra liberar a tela, não a fonte definitiva do estado.
    const getSession = async () => {
      try {
        const { data: { session } } = await comTimeout(supabase.auth.getSession(), 12000);
        setUser(session?.user ?? null);
        await carregarPerfil(session?.user ?? null);
      } catch (err) {
        console.error('Erro ao recuperar sessão:', err);
        setUser(null);
        setPerfil(null);
        setPerfilPronto(true);
      } finally {
        setLoading(false);
      }
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
    // Rascunho de atendimento é dado clínico não persistido — não pode
    // sobreviver ao logout no mesmo navegador (ver utils/rascunhoAtendimento).
    limparRascunhosAtendimento();
  };

  return (
    <AuthContext.Provider value={{ user, perfil, funcao: perfil?.funcao ?? null, login, logout, loading, perfilPronto }}>
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

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { supabase } from '../services/supabase';
import { usuariosService } from '../services/usuarios.service';
import { FUNCOES_CLINICAS } from '../constants/roles';
import { comTimeout } from '../utils/comTimeout';
import { limparRascunhosAtendimento, limparRascunhosLegados } from '../utils/rascunhoAtendimento';
import { iniciarMonitorInatividade, registrarLogoutPorInatividade } from '../utils/sessionSecurity';
import { encerrarSessaoNoNavegador, observarRevogacaoPendente } from '../services/sessao.service';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  // Só fica true quando temos uma resposta definitiva pro usuário atual —
  // ver comentário em carregarPerfil sobre por que isto existe.
  const [perfilPronto, setPerfilPronto] = useState(false);
  const [loading, setLoading] = useState(true);
  const ultimoUserIdRef = useRef(undefined);
  const requisicaoPerfilRef = useRef(0);
  // Depois de sair, nenhum evento de Auth com sessão pode reabrir a área
  // autenticada (ex: renovação de token que já estava a caminho, ou o
  // signOut que falhou sem rede) — só um login explícito.
  const encerradaRef = useRef(false);
  const [revogacaoPendente, setRevogacaoPendente] = useState(false);

  useEffect(() => observarRevogacaoPendente(setRevogacaoPendente), []);

  // Sair: primeiro fecha a tela e descarta os dados da sessão (na hora, sem
  // esperar a rede); depois encerra no navegador e tenta revogar no
  // servidor. Nunca lança: a saída local acontece mesmo com o servidor fora.
  const encerrarSessao = useCallback(async () => {
    encerradaRef.current = true;
    requisicaoPerfilRef.current++; // descarta leituras de perfil em andamento
    limparRascunhosAtendimento();
    setUser(null);
    setPerfil(null);
    setPerfilPronto(true);
    return encerrarSessaoNoNavegador();
  }, []);

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
    const requisicao = ++requisicaoPerfilRef.current;
    const authUserId = authUser?.id ?? null;
    if (authUserId !== ultimoUserIdRef.current) {
      if (ultimoUserIdRef.current !== undefined) limparRascunhosAtendimento();
      ultimoUserIdRef.current = authUserId;
      setPerfilPronto(false);
    }
    if (!authUser) {
      limparRascunhosAtendimento();
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
    // Uma leitura iniciada por uma sessão anterior não pode sobrescrever a
    // sessão atual se os eventos de Auth chegarem fora de ordem.
    if (requisicao !== requisicaoPerfilRef.current || authUser.id !== ultimoUserIdRef.current) return;

    if (!p || p.ativo === false) {
      await encerrarSessao();
      return;
    }
    setPerfil(p);
    setPerfilPronto(true);
  }, [encerrarSessao]);

  useEffect(() => {
    limparRascunhosLegados();
    // Verificar sessão atual — com teto de tempo: sem isso, se o lock
    // interno de sessão do Supabase demorar (ex: renovação de token
    // presa), a tela fica presa em "Carregando pacientes..." (App.jsx)
    // sem limite algum. `onAuthStateChange` abaixo ainda recebe o
    // resultado real quando ele chegar, então isto é só uma rede de
    // segurança pra liberar a tela, não a fonte definitiva do estado.
    const getSession = async () => {
      try {
        const { data: { session } } = await comTimeout(supabase.auth.getSession(), 12000);
        if (encerradaRef.current) return;
        setUser(session?.user ?? null);
        await carregarPerfil(session?.user ?? null);
      } catch (err) {
        console.error('Erro ao recuperar sessão:', err?.message || err);
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
      (event, session) => {
        if (encerradaRef.current && session) return;
        setUser(session?.user ?? null);
        setLoading(false);
        // Não consultar o banco dentro do callback de Auth: o cliente ainda
        // pode estar segurando o lock de atualização da própria sessão.
        setTimeout(() => carregarPerfil(session?.user ?? null), 0);
      }
    );

    return () => subscription.unsubscribe();
  }, [carregarPerfil]);

  useEffect(() => {
    if (!user) return undefined;
    return iniciarMonitorInatividade({
      aoExpirar: async () => {
        registrarLogoutPorInatividade();
        await encerrarSessao();
      },
    });
  }, [user, encerrarSessao]);

  const login = async (email, password) => {
    encerradaRef.current = false;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  };

  // Rascunho de atendimento é dado clínico não persistido — não pode
  // sobreviver ao logout no mesmo navegador (ver utils/rascunhoAtendimento).
  // Devolve { revogado } (ver services/sessao.service).
  const logout = encerrarSessao;

  const funcao = perfil?.funcao ?? null;
  // Papel clínico EFETIVO (migrações 30 e 35): função clínica direta
  // (Médico/Enfermeiro(a)/Psicólogo(a)/Fisioterapeuta), ou,
  // se Administrador, só o que outro administrador concedeu em
  // `papel_clinico_administrador` — nunca automático. `null` = nenhum
  // acesso clínico. Guards e telas devem usar isto (ou `temAcessoClinico`
  // abaixo), não mais `FUNCOES_CLINICAS.includes(funcao)` sozinho, que
  // deixou de incluir Administrador de propósito.
  const funcaoClinicaEfetiva = FUNCOES_CLINICAS.includes(funcao)
    ? funcao
    : (funcao === 'Administrador' ? perfil?.papel_clinico_administrador ?? null : null);
  const temAcessoClinico = funcaoClinicaEfetiva !== null;

  return (
    <AuthContext.Provider value={{ user, perfil, funcao, funcaoClinicaEfetiva, temAcessoClinico, login, logout, loading, perfilPronto, revogacaoPendente }}>
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

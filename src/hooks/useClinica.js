import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { configuracoesService } from '../services/configuracoes.service';
import { useAuth } from './useAuth';

const ClinicaContext = createContext();

// Usado só enquanto a busca no banco não volta (ou se a migração
// supabase_configuracoes_clinica.sql ainda não rodou) — nunca deve
// aparecer em documento impresso de verdade.
const CLINICA_PADRAO = { nome: '', nomeFantasia: '', cnpj: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', telefone: '', logoUrl: '' };

export const ClinicaProvider = ({ children }) => {
  // Só quem está autenticado tem SELECT em configuracoes_clinica — sem
  // sessão a busca sempre recusa com 42501. Antes disto, a primeira busca
  // disparava ainda na tela de login (sessão nem restaurada), o erro
  // "Não foi possível carregar..." ficava preso pro resto da sessão, e
  // nunca era tentado de novo mesmo depois do login funcionar — porque
  // este efeito só rodava uma vez, na montagem. Reagir ao login/logout
  // corrige as duas pontas: não mostra erro cedo demais, e busca de novo
  // assim que há sessão de verdade.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [clinica, setClinica] = useState(CLINICA_PADRAO);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    configuracoesService.buscar()
      .then((dados) => { if (dados) setClinica(dados); })
      .catch(() => setErro('Não foi possível carregar os dados da clínica. Confira antes de imprimir documentos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setErro('');
      return;
    }
    carregar();
  }, [carregar, userId]);

  return (
    <ClinicaContext.Provider value={{ clinica, loading, erro, recarregar: carregar }}>
      {erro && <div role="alert">{erro} <button onClick={carregar}>Tentar novamente</button></div>}
      {children}
    </ClinicaContext.Provider>
  );
};

export const useClinica = () => {
  const context = useContext(ClinicaContext);
  if (!context) {
    throw new Error('useClinica deve ser usado dentro de ClinicaProvider');
  }
  return context;
};

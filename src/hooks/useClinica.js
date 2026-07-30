import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { configuracoesService } from '../services/configuracoes.service';

const ClinicaContext = createContext();

// Usado só enquanto a busca no banco não volta (ou se a migração
// supabase_configuracoes_clinica.sql ainda não rodou) — nunca deve
// aparecer em documento impresso de verdade.
const CLINICA_PADRAO = { nome: '', nomeFantasia: '', cnpj: '', cep: '', endereco: '', numero: '', complemento: '', cidade: '', telefone: '', logoUrl: '' };

export const ClinicaProvider = ({ children }) => {
  const [clinica, setClinica] = useState(CLINICA_PADRAO);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => {
    configuracoesService.buscar()
      .then((dados) => { if (dados) setClinica(dados); })
      .catch((err) => console.error('Erro ao carregar configurações da clínica:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <ClinicaContext.Provider value={{ clinica, loading, recarregar: carregar }}>
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

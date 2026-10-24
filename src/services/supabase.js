import { createClient } from '@supabase/supabase-js'
import { extrairTipoLinkAuth } from '../utils/authRedirect'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// O cliente remove os tokens da URL durante a inicialização. Guardamos apenas
// o tipo não sensível do callback para distinguir recuperação de convite; os
// tokens continuam sendo tratados exclusivamente pelo Supabase.
const tipoRedirecionamentoAuth = extrairTipoLinkAuth(window.location.hash)

export const obterTipoRedirecionamentoAuth = () => tipoRedirecionamentoAuth

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Em estações clínicas compartilhadas, fechar a aba deve encerrar a
    // persistência local do token. O refresh continua ativo enquanto a aba
    // estiver aberta; a inatividade é tratada pelo AuthProvider.
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

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

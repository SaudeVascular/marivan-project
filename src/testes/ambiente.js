// Testes nunca falam com um Supabase de verdade: valores fictícios só para
// o cliente poder ser criado quando o Jest gera um mock automático de um
// serviço (isso carrega o módulo real uma vez).
process.env.REACT_APP_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'chave-ficticia-apenas-para-testes';

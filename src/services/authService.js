import { supabase } from './supabase';

console.log("authService.js carregado!");

const authService = {
  async login(email, password) {
    console.log("1. Tentando login direto");
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      console.log("2. Resposta recebida:", data ? "SUCESSO" : "FALHA", error?.message || "");
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (error) {
      console.error("3. Erro capturado:", error.message);
      throw error;
    }
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
};

export { authService };
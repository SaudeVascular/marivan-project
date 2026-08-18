import { supabase } from './supabase';

const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Envia o e-mail de recuperação de senha; o link leva o usuário de volta
  // para /redefinir-senha, já autenticado numa sessão de recuperação.
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw error;
  },

  // Usado na tela /redefinir-senha, após o usuário clicar no link do e-mail.
  async updatePassword(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    // Revoga os refresh tokens existentes depois da recuperação. Assim uma
    // sessão que tenha sido copiada antes da troca não continua renovável.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) throw signOutError;
  },
};

export { authService };

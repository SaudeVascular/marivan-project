import { createClient } from 'npm:@supabase/supabase-js@2.53.0';

const origensPermitidas = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const funcoesPermitidas = new Set([
  'Administrador', 'Médico', 'Enfermeiro(a)', 'Recepcionista', 'Financeiro',
]);

function headers(req: Request) {
  const origem = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origensPermitidas.has(origem) ? origem : 'http://localhost:3000',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function responder(req: Request, status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status, headers: headers(req) });
}

Deno.serve(async (req: Request) => {
  const origem = req.headers.get('origin') || '';
  if (!origensPermitidas.has(origem)) {
    return responder(req, 403, { error: 'Origem não permitida.' });
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req) });
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método não permitido.' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey || !authorization) {
    return responder(req, 401, { error: 'Não autorizado.' });
  }

  const clienteUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await clienteUsuario.auth.getUser();
  if (authError || !authData.user) return responder(req, 401, { error: 'Não autorizado.' });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: perfil, error: perfilError } = await admin
    .from('perfis')
    .select('funcao, ativo')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (perfilError || perfil?.funcao !== 'Administrador' || !perfil.ativo) {
    return responder(req, 403, { error: 'Apenas administradores ativos podem criar usuários.' });
  }

  let entrada: Record<string, unknown>;
  try {
    entrada = await req.json();
  } catch {
    return responder(req, 400, { error: 'Corpo inválido.' });
  }

  const nome = String(entrada.nome || '').trim();
  const email = String(entrada.email || '').trim().toLowerCase();
  const funcao = String(entrada.funcao || '');
  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || !funcoesPermitidas.has(funcao)) {
    return responder(req, 400, { error: 'Dados de usuário inválidos.' });
  }

  const { data: criado, error: criarError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origem}/ativar-conta`,
    data: { nome },
  });
  if (criarError || !criado.user) {
    return responder(req, 400, { error: 'Não foi possível enviar o convite. Verifique se o e-mail já está cadastrado ou tente mais tarde.' });
  }

  const perfilNovo = {
    nome,
    funcao,
    ativo: true,
    crm: String(entrada.crm || ''),
    uf: String(entrada.uf || ''),
    sexo: String(entrada.sexo || ''),
    nascimento: entrada.nascimento || null,
    cpf: String(entrada.cpf || ''),
    especialidade: String(entrada.especialidade || ''),
    area_atuacao: String(entrada.area_atuacao || ''),
  };
  // A atualização usa o JWT do Administrador solicitante, não a service_role.
  // Assim RLS e o trigger de auditoria registram o ator humano correto.
  const { error: atualizarError } = await clienteUsuario
    .from('perfis')
    .update(perfilNovo)
    .eq('id', criado.user.id);
  if (atualizarError) {
    await admin.auth.admin.deleteUser(criado.user.id);
    return responder(req, 500, { error: 'Não foi possível concluir o convite.' });
  }

  return responder(req, 201, { user: { id: criado.user.id, email: criado.user.email }, invited: true });
});

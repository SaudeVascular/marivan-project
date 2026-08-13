import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const projectRef = 'snhmydckyypgucwbsaus';

const limparAnsi = (texto) => texto.replace(/\x1b\[[0-9;]*m/g, '').trim();
const gerarSenha = () => `Pep-Hml-${randomBytes(12).toString('base64url')}!`;

const saidaCli = execFileSync(
  'npx',
  ['supabase', 'projects', 'api-keys', '--project-ref', projectRef, '--output', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);

const chaves = JSON.parse(limparAnsi(saidaCli));
const serviceRole = chaves.find((item) => item.name === 'service_role' || item.id === 'service_role');
const serviceKey = serviceRole?.api_key || serviceRole?.key;

if (!serviceKey) {
  throw new Error('Chave service_role da homologação não encontrada.');
}

const supabase = createClient(`https://${projectRef}.supabase.co`, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const contas = [
  { email: 'pep.admin@example.com', nome: 'Administrador Homologação', funcao: 'Administrador' },
  { email: 'pep.medico@example.com', nome: 'Médico Homologação', funcao: 'Médico' },
  { email: 'pep.enfermagem@example.com', nome: 'Enfermagem Homologação', funcao: 'Enfermeiro(a)' },
  { email: 'pep.recepcao@example.com', nome: 'Recepção Homologação', funcao: 'Recepcionista' },
];

const { data: listagem, error: erroListagem } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (erroListagem) throw erroListagem;

const resultado = [];
for (const conta of contas) {
  const senha = gerarSenha();
  const existente = listagem.users.find((usuario) => usuario.email === conta.email);
  let usuario;

  if (existente) {
    const { data, error } = await supabase.auth.admin.updateUserById(existente.id, {
      password: senha,
      user_metadata: { nome: conta.nome },
    });
    if (error) throw error;
    usuario = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: conta.email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: conta.nome },
    });
    if (error) throw error;
    usuario = data.user;
  }

  resultado.push({ ...conta, id: usuario.id, senha });
}

process.stdout.write(JSON.stringify(resultado));

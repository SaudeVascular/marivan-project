import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const arquivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((arquivo) => arquivo !== 'package-lock.json');

const padroes = [
  { nome: 'chave secreta Supabase', regex: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { nome: 'JWT possivelmente real', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  {
    nome: 'senha de banco preenchida',
    regex: /(?:SUPABASE_DB_PASSWORD|SUPABASE_PRODUCTION_DB_PASSWORD)\s*=\s*["']?[^\s"'$<{][^\s"']{5,}/g,
  },
];

const achados = [];
for (const arquivo of arquivos) {
  let conteudo;
  try {
    conteudo = await readFile(arquivo, 'utf8');
  } catch {
    continue;
  }

  for (const padrao of padroes) {
    for (const correspondencia of conteudo.matchAll(padrao.regex)) {
      const linha = conteudo.slice(0, correspondencia.index).split('\n').length;
      achados.push(`${arquivo}:${linha} — ${padrao.nome}`);
    }
  }
}

if (achados.length) {
  console.error('Possíveis credenciais encontradas em arquivos rastreados:');
  console.error(achados.map((achado) => `- ${achado}`).join('\n'));
  process.exit(1);
}

console.log(`OK: ${arquivos.length} arquivos rastreados sem credenciais aparentes.`);

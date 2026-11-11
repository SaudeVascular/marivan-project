// Dados de um documento na reimpressão (migração 46).
//
// Registro assinado com `emissao`: a 2ª via usa o retrato guardado na
// assinatura — paciente, idade, antecedentes e clínica como estavam —, não
// o cadastro atual. Sem `emissao` (rascunho, ou assinado antes da 46): usa
// os dados atuais e diz isso no documento.
const ANTECEDENTES = {
  has: 'has', dm: 'dm', dac: 'dac', dislipidemia: 'dislipidemia', tabagismo: 'tabagismo', etilismo: 'etilismo',
  outrasComorbidades: 'outras_comorbidades', cirurgias: 'cirurgias', medicamentosUso: 'medicamentos_uso', alergias: 'alergias',
};

export function codigoVerificacao(hash) {
  if (!hash) return null;
  return hash.slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
}

export function dadosDaEmissao(registro, pacienteAtual, clinicaAtual) {
  const e = registro?.emissao;
  if (!e) {
    return {
      original: false,
      paciente: pacienteAtual,
      antecedentes: pacienteAtual,
      clinica: clinicaAtual,
      codigo: null,
    };
  }
  const p = e.paciente || {};
  const c = e.clinica || {};
  const a = e.antecedentes || {};
  return {
    original: true,
    paciente: { id: pacienteAtual?.id, nome: p.nome || '', cpf: p.cpf || '', nascimento: p.nascimento || '', idade: p.idade ?? null },
    antecedentes: Object.fromEntries(Object.entries(ANTECEDENTES).map(([campo, coluna]) => [campo, a[coluna] || ''])),
    clinica: {
      nome: c.nome || '', nomeFantasia: c.nome_fantasia || '', cnpj: c.cnpj || '', cep: c.cep || '',
      endereco: c.endereco || '', numero: c.numero || '', complemento: c.complemento || '',
      cidade: c.cidade || '', telefone: c.telefone || '', logoUrl: c.logo_url || '',
    },
    codigo: codigoVerificacao(registro.emissaoHash),
  };
}

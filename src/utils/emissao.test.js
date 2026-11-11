import { codigoVerificacao, dadosDaEmissao } from './emissao';

const ATUAL = { id: 'p1', nome: 'Nome Atual', cpf: '390.533.447-05', nascimento: '1990-01-01', alergias: 'Nenhuma', has: 'Não' };
const CLINICA_ATUAL = { nome: 'Clínica Nova' };

test('com retrato: usa paciente, idade, antecedentes e clínica da emissão', () => {
  const registro = {
    emissaoHash: 'abcdef0123456789ffff',
    emissao: {
      modelo: 1,
      paciente: { nome: 'Nome Original', cpf: '529.982.247-25', nascimento: '1980-05-20', idade: 46 },
      antecedentes: { alergias: 'Dipirona', has: 'Sim', medicamentos_uso: 'Losartana' },
      clinica: { nome: 'Clínica Original', nome_fantasia: 'Original', cidade: 'Salvador' },
    },
  };
  const d = dadosDaEmissao(registro, ATUAL, CLINICA_ATUAL);
  expect(d.original).toBe(true);
  expect(d.paciente).toEqual(expect.objectContaining({ id: 'p1', nome: 'Nome Original', cpf: '529.982.247-25', idade: 46 }));
  expect(d.antecedentes).toEqual(expect.objectContaining({ alergias: 'Dipirona', has: 'Sim', medicamentosUso: 'Losartana' }));
  expect(d.clinica).toEqual(expect.objectContaining({ nome: 'Clínica Original', nomeFantasia: 'Original', cidade: 'Salvador' }));
  expect(d.codigo).toBe('ABCD-EF01-2345-6789');
});

test('sem retrato (rascunho ou registro antigo): dados atuais e marcado como tal', () => {
  const d = dadosDaEmissao({ emissao: null }, ATUAL, CLINICA_ATUAL);
  expect(d.original).toBe(false);
  expect(d.paciente).toBe(ATUAL);
  expect(d.clinica).toBe(CLINICA_ATUAL);
  expect(d.codigo).toBeNull();
});

test('código de verificação vazio sem hash', () => {
  expect(codigoVerificacao(null)).toBeNull();
});

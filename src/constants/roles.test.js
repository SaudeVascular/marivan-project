import { podeEmitir } from './roles';

// Espelho de papel_clinico_pode_registrar (migração 39).
const casos = [
  ['Psicólogo(a)', 'Consulta', true], ['Psicólogo(a)', 'Atestado', true], ['Psicólogo(a)', 'Relatório', true],
  ['Psicólogo(a)', 'Pedido de Exames', false], ['Psicólogo(a)', 'Laudo', false], ['Psicólogo(a)', 'Sinais Vitais', false],
  ['Psicólogo(a)', 'Receituário', false], ['Psicólogo(a)', 'Prescrição', false], ['Psicólogo(a)', 'Tipo novo', false],
  ['Fisioterapeuta', 'Consulta', true], ['Fisioterapeuta', 'Atestado', true], ['Fisioterapeuta', 'Relatório', true],
  ['Fisioterapeuta', 'Sinais Vitais', false], ['Fisioterapeuta', 'Pedido de Exames', false], ['Fisioterapeuta', 'Laudo', false],
  ['Fisioterapeuta', 'Receituário', false],
  ['Enfermeiro(a)', 'Consulta', true], ['Enfermeiro(a)', 'Evolução de Enfermagem', true], ['Enfermeiro(a)', 'Sinais Vitais', true],
  ['Enfermeiro(a)', 'Atestado', false], ['Enfermeiro(a)', 'Relatório', false], ['Enfermeiro(a)', 'Pedido de Exames', false],
  ['Enfermeiro(a)', 'Laudo', false], ['Enfermeiro(a)', 'Receituário', false],
  ['Médico', 'Laudo', true], ['Médico', 'Receituário', true], ['Médico', 'Tipo novo', true],
  [null, 'Consulta', false], ['Recepcionista', 'Relatório', false],
];

test.each(casos)('%s pode emitir %s: %s', (papel, tipo, esperado) => {
  expect(podeEmitir(papel, tipo)).toBe(esperado);
});

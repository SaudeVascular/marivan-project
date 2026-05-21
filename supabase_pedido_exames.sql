-- Adiciona os tipos 'Pedido de Exames' e 'Laudo' à tabela de consultas
-- Executar no SQL Editor do Supabase

ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_tipo_check;

ALTER TABLE consultas ADD CONSTRAINT consultas_tipo_check
  CHECK (tipo IN (
    'Consulta',
    'Atestado',
    'Receituário',
    'Prescrição',
    'Relatório',
    'Pedido de Exames',
    'Laudo'
  ));

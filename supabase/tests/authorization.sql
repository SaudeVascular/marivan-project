-- Banco descartável. Todas as fixtures e tentativas são revertidas.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok BOOLEAN, mensagem TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', mensagem; END IF; END;
$$;
-- Executa com o papel do chamador e desfaz inclusive operações permitidas.
CREATE FUNCTION pg_temp.tentar(comando TEXT, permitido BOOLEAN, caso TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE afetados BIGINT; aceito BOOLEAN := false;
BEGIN
  BEGIN
    EXECUTE comando;
    GET DIAGNOSTICS afetados = ROW_COUNT;
    aceito := afetados > 0;
    RAISE EXCEPTION USING ERRCODE = 'ZT001', MESSAGE = 'rollback da tentativa';
  EXCEPTION
    WHEN SQLSTATE 'ZT001' THEN NULL;
    WHEN insufficient_privilege THEN aceito := false;
    WHEN check_violation THEN aceito := false;
    WHEN raise_exception THEN
      IF SQLERRM = 'Somente administradores podem alterar função, status ou e-mail' THEN
        aceito := false;
      ELSE RAISE;
      END IF;
  END;
  PERFORM pg_temp.assert_ok(aceito = permitido, caso);
END;
$$;

CREATE TEMP TABLE atores(id UUID, funcao TEXT, ativo BOOLEAN, papel_clinico TEXT);
INSERT INTO atores VALUES
 ('a9000000-0000-4000-8000-000000000001','Médico',true,NULL),
 ('a9000000-0000-4000-8000-000000000002','Enfermeiro(a)',true,NULL),
 ('a9000000-0000-4000-8000-000000000003','Recepcionista',true,NULL),
 ('a9000000-0000-4000-8000-000000000004','Financeiro',true,NULL),
 ('a9000000-0000-4000-8000-000000000005','Administrador',true,NULL),
 ('a9000000-0000-4000-8000-000000000006','Médico',false,NULL),
 ('a9000000-0000-4000-8000-000000000007','Pendente',false,NULL),
 ('a9000000-0000-4000-8000-000000000008','Administrador',true,'Médico');
INSERT INTO auth.users(id,email) SELECT id, id::text || '@example.invalid' FROM atores;
SET LOCAL session_replication_role = replica;
UPDATE public.perfis p SET funcao=a.funcao, ativo=a.ativo, nome='Teste RBAC', crm='123', uf='BA',
  papel_clinico_administrador=a.papel_clinico
FROM atores a WHERE p.id=a.id;
UPDATE public.perfis SET assinatura_imagem='data:image/png;base64,SEGREDO'
  WHERE id='a9000000-0000-4000-8000-000000000001';
SET LOCAL session_replication_role = origin;
INSERT INTO public.pacientes(id,nome,alergias) VALUES ('a9000000-0000-4000-8000-000000000010','Paciente fictício RBAC','Dado clínico fictício');
INSERT INTO public.consultas(id,paciente_id,tipo,conteudo,status,created_by) VALUES
 ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010','Consulta','Texto fictício','Assinado','a9000000-0000-4000-8000-000000000001');
INSERT INTO public.medicamentos_receita(id,consulta_id,nome) VALUES ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010','Fictício');
INSERT INTO public.modelos_receita(id,user_id,nome,conteudo) SELECT id,id,'Modelo fictício','Texto fictício' FROM atores;
INSERT INTO public.agendamentos(id,paciente_id,data,hora) VALUES ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010',CURRENT_DATE,'09:00');
INSERT INTO public.convenios(id,nome) VALUES ('a9000000-0000-4000-8000-000000000010','Convênio fictício');
INSERT INTO public.convenios(id,nome) VALUES ('a9000000-0000-4000-8000-000000000011','Outro convênio fictício');
INSERT INTO public.procedimentos(id,nome) VALUES ('a9000000-0000-4000-8000-000000000010','Procedimento fictício');
INSERT INTO public.convenio_valores(id,convenio_id,procedimento_id,valor) VALUES ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010',1);
INSERT INTO public.cobrancas(id,paciente_id,medico_id,valor) VALUES ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000001',1);
INSERT INTO public.configuracoes_clinica(id,nome) VALUES ('a9000000-0000-4000-8000-000000000010','Clínica fictícia');
INSERT INTO public.filiais(id,nome) VALUES ('a9000000-0000-4000-8000-000000000010','Filial fictícia');
INSERT INTO public.auditoria(id,tabela,operacao) VALUES ('a9000000-0000-4000-8000-000000000010','teste','INSERT');
INSERT INTO public.exames(id,nome,tipo) VALUES ('a9000000-0000-4000-8000-000000000010','Exame fictício','Laboratorial');
INSERT INTO public.acessos(id,usuario_id,paciente_id,acao) VALUES ('a9000000-0000-4000-8000-000000000010','a9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000010','abrir_prontuario');

CREATE TEMP TABLE matriz(tabela TEXT, leitura TEXT[], escrita TEXT[], exclusao TEXT[], campo TEXT);
-- consultas e medicamentos_receita saíram desta matriz genérica: leitura
-- depende do papel clínico EFETIVO (funcao direta, ou Administrador com
-- papel_clinico_administrador concedido), que esta tabela não modela por
-- linha — são testadas à parte, logo abaixo, junto da variável `clinico`.
INSERT INTO matriz VALUES
 -- pacientes: edição só pela função atualizar_paciente (migrações 41/42),
 -- testada à parte, logo abaixo; UPDATE direto é recusado para todos.
 ('pacientes',ARRAY['Médico','Enfermeiro(a)','Recepcionista','Financeiro','Administrador'],ARRAY[]::TEXT[],ARRAY[]::TEXT[],'nome'),
 ('agendamentos',ARRAY['Médico','Enfermeiro(a)','Recepcionista','Financeiro','Administrador'],ARRAY['Médico','Enfermeiro(a)','Recepcionista','Administrador'],ARRAY['Administrador'],'hora'),
 ('convenios',ARRAY['Médico','Enfermeiro(a)','Recepcionista','Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],'nome'),
 ('procedimentos',ARRAY['Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],'nome'),
 ('convenio_valores',ARRAY['Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],'valor'),
 ('cobrancas',ARRAY['Médico','Financeiro','Administrador'],ARRAY['Financeiro','Administrador'],ARRAY['Administrador'],'valor'),
 ('configuracoes_clinica',ARRAY['Médico','Enfermeiro(a)','Recepcionista','Financeiro','Administrador'],ARRAY['Administrador'],ARRAY[]::TEXT[],'nome'),
 ('filiais',ARRAY['Médico','Enfermeiro(a)','Recepcionista','Financeiro','Administrador'],ARRAY['Administrador'],ARRAY['Administrador'],'nome'),
 -- Auditoria: ninguém lê a tabela base (migração 36); Administrador lê
 -- pela auditoria_view mascarada — ver supabase/tests/auditoria_mascarada.sql.
 ('auditoria',ARRAY[]::TEXT[],ARRAY[]::TEXT[],ARRAY[]::TEXT[],'tabela'),
 -- Acessos (migração 38): só pela função registrar_acesso e pela
 -- acessos_view — ver supabase/tests/auditoria_acessos.sql.
 ('acessos',ARRAY[]::TEXT[],ARRAY[]::TEXT[],ARRAY[]::TEXT[],'detalhe'),
 -- Catálogo de exames: leitura por quem usa no Pedido de Exames (papel
 -- clínico direto) mais Administrador (gerencia o catálogo, mesmo sem
 -- papel_clinico_administrador concedido — não é dado clínico de
 -- paciente, é configuração da clínica); escrita só Administrador.
 ('exames',ARRAY['Médico','Enfermeiro(a)','Administrador'],ARRAY['Administrador'],ARRAY['Administrador'],'nome');
GRANT SELECT ON atores, matriz TO authenticated;

-- Inventário exaustivo: uma tabela nova exige ampliar a auditoria.
DO $$
DECLARE t RECORD; papel TEXT;
BEGIN
  PERFORM pg_temp.assert_ok((SELECT count(*)=16 FROM pg_tables WHERE schemaname='public'), 'inventário de 16 tabelas públicas');
  FOR t IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' LOOP
    PERFORM pg_temp.assert_ok(t.relrowsecurity, 'RLS habilitada: ' || t.relname);
    FOREACH papel IN ARRAY ARRAY['anon','authenticated'] LOOP
      PERFORM pg_temp.assert_ok(NOT has_table_privilege(papel,t.oid,'TRUNCATE'), papel || ' sem TRUNCATE: ' || t.relname);
      PERFORM pg_temp.assert_ok(NOT has_table_privilege(papel,t.oid,'TRIGGER'), papel || ' sem TRIGGER: ' || t.relname);
    END LOOP;
    PERFORM pg_temp.assert_ok(NOT has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE'), 'anon sem acesso: ' || t.relname);
  END LOOP;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a RECORD; m RECORD; alvo TEXT := 'a9000000-0000-4000-8000-000000000010'; clinico BOOLEAN;
  prescritor BOOLEAN; own_model TEXT; outro_admin UUID;
BEGIN
  FOR a IN SELECT * FROM atores LOOP
    PERFORM set_config('request.jwt.claim.sub',a.id::TEXT,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated')::TEXT,true);
    -- Papel clínico efetivo: Médico/Enfermeiro(a) direto, ou Administrador
    -- com papel_clinico_administrador concedido (ator 008 nas fixtures).
    clinico := a.ativo AND (a.funcao IN ('Médico','Enfermeiro(a)') OR (a.funcao='Administrador' AND a.papel_clinico IS NOT NULL));
    -- COALESCE evita que `a.papel_clinico = 'Médico'` propague NULL (e
    -- derrube o assert por engano) quando papel_clinico é nulo — mesmo
    -- cuidado que a correção da migração 30 documenta na trigger.
    prescritor := a.ativo AND (a.funcao='Médico' OR (a.funcao='Administrador' AND COALESCE(a.papel_clinico, '') = 'Médico'));
    PERFORM pg_temp.tentar(format('SELECT id FROM public.consultas WHERE id=%L',alvo),clinico,a.funcao || '/' || a.ativo || ' leitura consultas (papel efetivo)');
    PERFORM pg_temp.tentar(format('SELECT id FROM public.medicamentos_receita WHERE id=%L',alvo),clinico,a.funcao || '/' || a.ativo || ' leitura medicamentos_receita (papel efetivo)');
    FOR m IN SELECT * FROM matriz LOOP
      PERFORM pg_temp.tentar(format('SELECT id FROM public.%I WHERE id=%L',m.tabela,alvo),a.ativo AND a.funcao=ANY(m.leitura),a.funcao || '/' || a.ativo || ' leitura ' || m.tabela);
      PERFORM pg_temp.tentar(format('UPDATE public.%I SET %I=%L WHERE id=%L',m.tabela,m.campo,CASE WHEN m.campo='valor' THEN '1' WHEN m.campo='hora' THEN '09:00' ELSE 'Teste fictício' END,alvo),a.ativo AND a.funcao=ANY(m.escrita),a.funcao || '/' || a.ativo || ' edição ' || m.tabela);
      PERFORM pg_temp.tentar(format('DELETE FROM public.%I WHERE id=%L',m.tabela,alvo),a.ativo AND a.funcao=ANY(m.exclusao),a.funcao || '/' || a.ativo || ' exclusão ' || m.tabela);
    END LOOP;
    PERFORM pg_temp.tentar(format('SELECT alergias FROM public.pacientes WHERE id=%L',alvo),false,'dados clínicos nunca lidos pela tabela base');
    PERFORM pg_temp.assert_ok(COALESCE((SELECT alergias IS NOT NULL FROM public.pacientes_view WHERE id=alvo::UUID),false)=clinico,'view mascara clínica: ' || a.funcao || '/' || a.ativo);
    PERFORM pg_temp.tentar('SELECT cpf FROM public.perfis',false,'CPF dos profissionais não exposto diretamente');
    -- Assinatura digitalizada: diferente de cpf/nascimento/sexo, nem
    -- Administrador vê a de outro perfil — o risco de uso indevido
    -- (falsificar documento) é maior que os outros campos mascarados.
    PERFORM pg_temp.assert_ok(
      COALESCE((SELECT assinatura_imagem IS NOT NULL FROM public.perfis_view WHERE id='a9000000-0000-4000-8000-000000000001'),false)
        = (a.ativo AND a.id='a9000000-0000-4000-8000-000000000001'::UUID),
      'assinatura digitalizada só visível ao próprio dono: ' || a.funcao || '/' || a.ativo);
    PERFORM pg_temp.tentar(format('UPDATE public.perfis SET nome=%L WHERE id=%L','Teste fictício',a.id),a.ativo,'edição do próprio perfil');
    PERFORM pg_temp.tentar(format('UPDATE public.perfis SET funcao=%L WHERE id=%L','Administrador',a.id),a.ativo AND a.funcao='Administrador','autoelevação bloqueada');
    -- Papel clínico de Administrador: nunca autoconcedido, mesmo por quem
    -- já é Administrador; só outro Administrador ativo concede; e só
    -- existe em conta que já é Administrador (CHECK da migração 30).
    outro_admin := CASE WHEN a.id = 'a9000000-0000-4000-8000-000000000008'::UUID
      THEN 'a9000000-0000-4000-8000-000000000005'::UUID
      ELSE 'a9000000-0000-4000-8000-000000000008'::UUID END;
    -- O valor de destino precisa ser DIFERENTE do que o ator já tem (ator
    -- 008 já nasce com 'Médico' na fixture) — senão a trigger não vê
    -- mudança (`NEW IS DISTINCT FROM OLD` falso) e nem chega a barrar
    -- nada, porque não havia o que barrar; o teste ficaria inconclusivo.
    PERFORM pg_temp.tentar(
      format('UPDATE public.perfis SET papel_clinico_administrador=%L WHERE id=%L',
        CASE WHEN a.papel_clinico = 'Médico' THEN 'Enfermeiro(a)' ELSE 'Médico' END, a.id),
      false, 'papel clínico nunca é autoconcedido');
    PERFORM pg_temp.tentar(format('UPDATE public.perfis SET papel_clinico_administrador=%L WHERE id=%L','Médico',outro_admin),a.ativo AND a.funcao='Administrador','concessão de papel clínico a outro administrador');
    PERFORM pg_temp.tentar(format('UPDATE public.perfis SET papel_clinico_administrador=%L WHERE id=%L','Médico','a9000000-0000-4000-8000-000000000001'),false,'papel clínico exige conta Administrador');
    own_model := format('SELECT id FROM public.modelos_receita WHERE user_id=%L',a.id);
    PERFORM pg_temp.tentar(own_model,prescritor,'modelo próprio por papel clínico efetivo e ativação');
    PERFORM pg_temp.tentar(format('SELECT id FROM public.modelos_receita WHERE user_id<>%L',a.id),false,'modelos privados de outro autor');
    PERFORM pg_temp.tentar(format('INSERT INTO public.modelos_receita(user_id,nome,conteudo) VALUES (%L,%L,%L)',a.id,'Teste','Fictício'),prescritor,'criação de modelo por papel clínico efetivo');
    PERFORM pg_temp.tentar(format('DELETE FROM public.modelos_receita WHERE user_id=%L',a.id),prescritor,'exclusão de modelo próprio');
    PERFORM pg_temp.tentar('SELECT * FROM public.operacoes_registro',false,'recibos sem acesso direto');
    PERFORM pg_temp.tentar(format('INSERT INTO public.cobrancas(paciente_id,valor) VALUES (%L,1)',alvo),a.ativo AND a.funcao IN ('Financeiro','Administrador'),'criação financeira');
    -- Versão propositalmente errada: quem pode editar chega ao gatilho e
    -- recebe conflito (P4090); quem não pode nem encontra a linha (42501).
    -- Nenhum dos dois altera o paciente.
    BEGIN
      PERFORM public.atualizar_paciente(alvo::UUID, 'ativo', 999999, '{"ativo": true}');
      PERFORM pg_temp.assert_ok(false, a.funcao || '/' || a.ativo || ' edição pela função sem conferir versão');
    EXCEPTION
      WHEN SQLSTATE 'P4090' THEN
        PERFORM pg_temp.assert_ok(a.ativo AND a.funcao IN ('Médico','Enfermeiro(a)','Recepcionista','Administrador'), a.funcao || '/' || a.ativo || ' edição pacientes pela função');
      WHEN insufficient_privilege THEN
        PERFORM pg_temp.assert_ok(NOT (a.ativo AND a.funcao IN ('Médico','Enfermeiro(a)','Recepcionista','Administrador')), a.funcao || '/' || a.ativo || ' edição pacientes pela função negada');
    END;
    PERFORM pg_temp.tentar('INSERT INTO public.pacientes(nome) VALUES (''Fictício'')',a.ativo AND a.funcao IN ('Médico','Enfermeiro(a)','Recepcionista','Administrador'),'criação de paciente');
    PERFORM pg_temp.tentar(format('INSERT INTO public.consultas(paciente_id,tipo) VALUES (%L,''Consulta'')',alvo),false,'consulta exige RPC');
    PERFORM pg_temp.tentar(format('INSERT INTO public.medicamentos_receita(consulta_id,nome) VALUES (%L,''Fictício'')',alvo),false,'receita assinada não ganha itens');
    PERFORM pg_temp.tentar(format('INSERT INTO public.agendamentos(paciente_id,data,hora) VALUES (%L,CURRENT_DATE,''10:00'')',alvo),a.ativo AND a.funcao <> 'Financeiro','criação de agenda (Financeiro passou a só ler)');
    PERFORM pg_temp.tentar('INSERT INTO public.convenios(nome) VALUES (''Fictício'')',a.ativo AND a.funcao IN ('Financeiro','Administrador'),'criação de convênio');
    PERFORM pg_temp.tentar('INSERT INTO public.procedimentos(nome) VALUES (''Fictício'')',a.ativo AND a.funcao IN ('Financeiro','Administrador'),'criação de procedimento');
    PERFORM pg_temp.tentar(format('INSERT INTO public.convenio_valores(convenio_id,procedimento_id,valor) VALUES (''a9000000-0000-4000-8000-000000000011'',%L,1)',alvo),a.ativo AND a.funcao IN ('Financeiro','Administrador'),'criação de preço');
    PERFORM pg_temp.tentar('INSERT INTO public.configuracoes_clinica(nome) VALUES (''Fictício'')',false,'configuração sem inserção pelo cliente');
    PERFORM pg_temp.tentar('INSERT INTO public.filiais(nome) VALUES (''Fictício'')',a.ativo AND a.funcao='Administrador','criação de filial');
    PERFORM pg_temp.tentar('INSERT INTO public.auditoria(tabela,operacao) VALUES (''teste'',''INSERT'')',false,'auditoria apenas por trigger');
    PERFORM pg_temp.assert_ok(NOT has_table_privilege('authenticated','public.operacoes_registro','SELECT,INSERT,UPDATE,DELETE'),'recibos sem privilégios de cliente');
    IF a.funcao='Médico' AND a.ativo THEN
      PERFORM pg_temp.tentar('SELECT id FROM public.cobrancas WHERE medico_id IS DISTINCT FROM auth.uid()',false,'médico não lê cobranças alheias');
    END IF;
  END LOOP;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'OK: matriz de autorização, isolamento e privilégios mínimos.' AS resultado;

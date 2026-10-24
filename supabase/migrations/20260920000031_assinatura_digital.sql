-- Assinatura digitalizada do profissional (desenhada na tela — toque,
-- caneta ou mouse — ou enviada como arquivo de imagem que já tinha
-- pronta) para aparecer nos documentos impressos, acima do nome, no
-- lugar da linha em branco.
BEGIN;

-- Guardada como data URI (base64) direto na tabela: assinatura é uma
-- imagem pequena (poucos KB) e isso evita depender de bucket de Storage
-- e resolve sozinho o formato que a geração de PDF (pdfmake) já espera
-- (data URI), sem outra etapa de busca/conversão a cada impressão.
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS assinatura_imagem TEXT;

COMMENT ON COLUMN public.perfis.assinatura_imagem IS
  'Assinatura digitalizada do profissional (data URI de imagem PNG), usada nos documentos impressos. Só o próprio dono lê pela view — diferente de nome/CRM/especialidade, uma imagem de assinatura pode ser reaproveitada pra falsificar documento se qualquer perfil conseguisse ler a de outro.';

-- Mesma view de sempre (migração 30), só acrescentando a coluna nova
-- mascarada — só o próprio dono vê a própria assinatura, nem
-- Administrador (diferente de cpf/nascimento/sexo, que Administrador já
-- vê): o risco de uma imagem de assinatura vazada é maior que os outros
-- campos mascarados, então a exceção de Administrador não se aplica aqui.
CREATE OR REPLACE VIEW public.perfis_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.nome,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.email END AS email,
  p.funcao,
  p.crm,
  p.uf,
  p.especialidade,
  p.area_atuacao,
  p.ativo,
  p.created_at,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.cpf END AS cpf,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.nascimento END AS nascimento,
  CASE WHEN p.id = auth.uid() OR public.current_user_funcao() = 'Administrador'
       THEN p.sexo END AS sexo,
  p.papel_clinico_administrador,
  CASE WHEN p.id = auth.uid() THEN p.assinatura_imagem END AS assinatura_imagem
FROM public.perfis p
WHERE
  p.id = auth.uid()
  OR public.current_user_funcao() = 'Administrador'
  OR (public.current_user_ativo() AND p.ativo);

REVOKE ALL ON public.perfis_view FROM anon;
GRANT SELECT ON public.perfis_view TO authenticated;

COMMIT;

-- Auditoria de LEITURA: quem abriu cada prontuário e quem gerou cada
-- documento (segunda opinião, 24/10/2026). A tabela `auditoria` (migração
-- 09) só registra alterações.
--
-- Gravação só pela função registrar_acesso (SECURITY DEFINER): o autor é
-- sempre auth.uid() — o cliente não escolhe em nome de quem registra —,
-- a ação vem de uma lista fechada e o paciente precisa existir. Ninguém
-- lê, altera ou apaga a tabela diretamente; Administrador lê pela
-- acessos_view (nomes de usuário e paciente, nada clínico).
--
-- Limite conhecido: o registro é disparado pelo app ao abrir o prontuário
-- ou imprimir. Uma leitura feita direto na API (fora do app) por alguém
-- com acesso clínico não passa por aqui — a RLS continua decidindo quem
-- pode ler; esta tabela documenta o uso normal do sistema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.acessos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id),
  paciente_id  UUID NOT NULL REFERENCES public.pacientes(id),
  acao         TEXT NOT NULL CHECK (acao IN ('abrir_prontuario', 'imprimir_documento')),
  detalhe      TEXT CHECK (char_length(detalhe) <= 120),
  registro_id  UUID,
  em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acessos_em ON public.acessos (em DESC);
CREATE INDEX IF NOT EXISTS idx_acessos_paciente ON public.acessos (paciente_id, em DESC);
CREATE INDEX IF NOT EXISTS idx_acessos_usuario ON public.acessos (usuario_id, em DESC);

ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acessos FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_acesso(
  p_paciente_id UUID, p_acao TEXT, p_detalhe TEXT DEFAULT NULL, p_registro_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_ativo() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_acao NOT IN ('abrir_prontuario', 'imprimir_documento') THEN
    RAISE EXCEPTION 'Ação de acesso desconhecida: %', p_acao USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.acessos (usuario_id, paciente_id, acao, detalhe, registro_id)
  VALUES (auth.uid(), p_paciente_id, p_acao, left(NULLIF(btrim(p_detalhe), ''), 120), p_registro_id);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(UUID, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE VIEW public.acessos_view
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  a.id, a.em, a.acao, a.detalhe, a.registro_id,
  a.usuario_id, u.nome AS usuario_nome, u.funcao AS usuario_funcao,
  a.paciente_id, p.nome AS paciente_nome
FROM public.acessos a
LEFT JOIN public.perfis u ON u.id = a.usuario_id
LEFT JOIN public.pacientes p ON p.id = a.paciente_id
WHERE public.current_user_ativo() AND public.current_user_funcao() = 'Administrador';

REVOKE ALL ON public.acessos_view FROM PUBLIC, anon;
GRANT SELECT ON public.acessos_view TO authenticated;

COMMIT;

-- Catálogo de exames do Pedido de Exames — hoje é um array fixo no
-- frontend (EXAMES_DISPONIVEIS, em DocumentosPages.js), sem tela pra
-- adicionar/editar/desativar exame sem mexer em código. Esta migração
-- move isso pro banco: dois tipos (Laboratorial, Imagem) e uma categoria
-- livre por exame (pra continuar agrupando na tela de administração,
-- ex. "Rotina", "Cardiológico"); no Pedido de Exames em si o médico
-- busca por nome/código TUSS em vez de escolher de uma lista.
BEGIN;

CREATE TABLE public.exames (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  tuss        TEXT,
  tipo        TEXT NOT NULL CHECK (tipo IN ('Laboratorial', 'Imagem')),
  categoria   TEXT NOT NULL DEFAULT '',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exames_tipo_categoria ON public.exames (tipo, categoria);

ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

-- Leitura: quem tem papel clínico efetivo (monta Pedido de Exames) ou
-- Administrador (gerencia o catálogo). Escrita: só Administrador — é
-- catálogo da clínica, mesmo padrão de configurações_clinica/filiais,
-- não algo que cada profissional edita por conta própria.
CREATE POLICY "ver exames" ON public.exames FOR SELECT
  USING (public.current_user_ativo() AND (public.current_user_papel_clinico() IS NOT NULL OR public.current_user_funcao() = 'Administrador'));
CREATE POLICY "gerenciar exames" ON public.exames FOR ALL
  USING (public.current_user_funcao() = 'Administrador')
  WITH CHECK (public.current_user_funcao() = 'Administrador');

REVOKE ALL ON public.exames FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exames TO authenticated;

CREATE TRIGGER trg_auditoria_exames
  AFTER INSERT OR UPDATE OR DELETE ON public.exames
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- Catálogo inicial: os mesmos exames e códigos TUSS que já estavam fixos
-- em EXAMES_DISPONIVEIS — só move pro banco, não troca nada. "Cardiologia"
-- (ECG, ecocardiograma, teste ergométrico...) virou tipo Imagem — são
-- exames funcionais/de imagem, não coleta de sangue.
INSERT INTO public.exames (nome, tuss, tipo, categoria) VALUES
  ('Hemograma completo', '40303289', 'Laboratorial', 'Rotina'),
  ('Glicemia de jejum', '40302032', 'Laboratorial', 'Rotina'),
  ('Hemoglobina glicada (HbA1c)', '40302024', 'Laboratorial', 'Rotina'),
  ('Colesterol total e frações', '40302059', 'Laboratorial', 'Rotina'),
  ('Triglicerídeos', '40302121', 'Laboratorial', 'Rotina'),
  ('Creatinina', '40302067', 'Laboratorial', 'Rotina'),
  ('Ureia', '40302130', 'Laboratorial', 'Rotina'),
  ('Ácido úrico', '40302016', 'Laboratorial', 'Rotina'),
  ('Sódio', '40302113', 'Laboratorial', 'Rotina'),
  ('Potássio', '40302091', 'Laboratorial', 'Rotina'),
  ('Magnésio', '40302075', 'Laboratorial', 'Rotina'),
  ('TGO (AST)', '40302105', 'Laboratorial', 'Rotina'),
  ('TGP (ALT)', '40302113', 'Laboratorial', 'Rotina'),
  ('Proteína C reativa (PCR)', '40302091', 'Laboratorial', 'Rotina'),
  ('TSH', '40302210', 'Laboratorial', 'Rotina'),
  ('T4 livre', '40302202', 'Laboratorial', 'Rotina'),
  ('Troponina I ou T', '40302229', 'Laboratorial', 'Cardiológico'),
  ('BNP / NT-proBNP', '40302350', 'Laboratorial', 'Cardiológico'),
  ('D-dímero', '40302270', 'Laboratorial', 'Cardiológico'),
  ('Coagulograma (TAP / INR / TTPA)', '40303157', 'Laboratorial', 'Cardiológico'),
  ('Ferritina', '40302044', 'Laboratorial', 'Cardiológico'),
  ('Vitamina D (25-OH)', '40302563', 'Laboratorial', 'Cardiológico'),
  ('Eletrocardiograma (ECG)', '40301010', 'Imagem', 'Cardiologia'),
  ('Ecocardiograma transtorácico', '40901254', 'Imagem', 'Cardiologia'),
  ('Teste ergométrico', '40301052', 'Imagem', 'Cardiologia'),
  ('Holter 24 horas', '40301036', 'Imagem', 'Cardiologia'),
  ('MAPA 24 horas', '40301028', 'Imagem', 'Cardiologia'),
  ('Cintilografia miocárdica', '40801293', 'Imagem', 'Cardiologia'),
  ('Angiotomografia coronariana', '40901122', 'Imagem', 'Cardiologia'),
  ('Ressonância magnética cardíaca', '40914153', 'Imagem', 'Cardiologia'),
  ('Radiografia de tórax', '40901130', 'Imagem', 'Geral'),
  ('Ultrassom de abdome total', '40901041', 'Imagem', 'Geral'),
  ('Doppler de carótidas e vertebrais', '40901386', 'Imagem', 'Geral'),
  ('Doppler venoso de MMII', '40901203', 'Imagem', 'Geral'),
  ('Índice tornozelo-braquial (ITB)', '40301079', 'Imagem', 'Geral');

COMMIT;

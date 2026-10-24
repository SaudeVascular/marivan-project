-- ============================================================
-- SCHEMA DO PRONTUÁRIO ELETRÔNICO — Supabase (PostgreSQL)
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Tabela de Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  cpf           TEXT        UNIQUE,
  nascimento    DATE,
  nome_mae      TEXT,
  telefone      TEXT,
  convenio      TEXT,
  cep           TEXT,
  endereco      TEXT,
  alergias      TEXT,

  -- Antecedentes clínicos
  has           TEXT        DEFAULT '',
  dm            TEXT        DEFAULT '',
  dac           TEXT        DEFAULT '',
  dislipidemia  TEXT        DEFAULT '',
  tabagismo     TEXT        DEFAULT '',
  etilismo      TEXT        DEFAULT '',
  cirurgias     TEXT        DEFAULT '',
  medicamentos_uso TEXT     DEFAULT '',

  -- Controle
  ativo         BOOLEAN     DEFAULT true,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Consultas / Registros
-- Armazena todos os tipos: Consulta, Atestado, Receituário, Prescrição, Relatório
CREATE TABLE IF NOT EXISTS consultas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo          TEXT        NOT NULL DEFAULT 'Consulta'
                            CHECK (tipo IN ('Consulta','Atestado','Receituário','Prescrição','Relatório')),
  titulo        TEXT,
  conteudo      TEXT,
  data          DATE        DEFAULT CURRENT_DATE,
  hora          TEXT,
  status        TEXT        DEFAULT 'Realizada',

  -- Consulta estruturada
  queixa_principal      TEXT,
  exame_fisico          TEXT,
  hipotese_diagnostica  TEXT,
  conduta               TEXT,

  -- Sinais vitais
  pressao_arterial      TEXT,
  frequencia_cardiaca   INTEGER,
  temperatura           NUMERIC(4,1),
  peso                  NUMERIC(5,2),
  altura                NUMERIC(5,2),
  saturacao             INTEGER,

  -- Atestado
  medico                TEXT,
  crm                   TEXT,
  dias_afastamento      INTEGER,
  cid                   TEXT,

  -- Controle
  medico_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Medicamentos (itens do receituário)
CREATE TABLE IF NOT EXISTS medicamentos_receita (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID    NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  ordem       INTEGER DEFAULT 1,
  nome        TEXT    NOT NULL,
  dose        TEXT,
  frequencia  TEXT,
  duracao     TEXT,
  instrucoes  TEXT
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pacientes_nome   ON pacientes(nome);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf    ON pacientes(cpf);
CREATE INDEX IF NOT EXISTS idx_consultas_paciente ON consultas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_data   ON consultas(data);
CREATE INDEX IF NOT EXISTS idx_consultas_tipo   ON consultas(tipo);

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON pacientes;
CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Apenas usuários autenticados acessam os dados
-- ============================================================
ALTER TABLE pacientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos_receita ENABLE ROW LEVEL SECURITY;

-- Pacientes
CREATE POLICY "ver pacientes"    ON pacientes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "criar pacientes"  ON pacientes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "editar pacientes" ON pacientes FOR UPDATE USING (auth.role() = 'authenticated');

-- Consultas
CREATE POLICY "ver consultas"    ON consultas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "criar consultas"  ON consultas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "editar consultas" ON consultas FOR UPDATE USING (auth.role() = 'authenticated');

-- Medicamentos
CREATE POLICY "ver medicamentos"    ON medicamentos_receita FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "criar medicamentos"  ON medicamentos_receita FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "editar medicamentos" ON medicamentos_receita FOR UPDATE USING (auth.role() = 'authenticated');

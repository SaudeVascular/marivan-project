-- Corrige o trigger para não bloquear a criação de usuários caso ocorra qualquer erro
CREATE OR REPLACE FUNCTION criar_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO perfis (id, email, nome, funcao)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'funcao', 'Médico')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- ignora erros para não bloquear o cadastro do usuário
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

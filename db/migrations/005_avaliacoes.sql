-- 005: avaliação pós-entrega (uma por pedido) e depoimentos na vitrine

CREATE TABLE IF NOT EXISTS avaliacoes (
  id          bigserial PRIMARY KEY,
  pedido_id   uuid NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  cliente_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota        int NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario  text,
  publicada   boolean NOT NULL DEFAULT false,   -- aparece na página inicial (admin aprova)
  resposta    text,                             -- resposta da loja, opcional
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avaliacoes_publicada_idx ON avaliacoes(publicada, criado_em DESC);

INSERT INTO configuracoes (chave, valor) VALUES
  ('avaliacao_auto_publicar', 'true')   -- notas 4 e 5 com comentário entram na vitrine sem aprovação
ON CONFLICT (chave) DO NOTHING;

-- alerta de senha inicial (admin123 / moto123) ainda em uso
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_padrao boolean NOT NULL DEFAULT false;
UPDATE usuarios SET senha_padrao = true
WHERE papel IN ('admin', 'motorista') AND senha_hash LIKE '$2a$%'
  AND CASE WHEN senha_hash LIKE '$2a$%' THEN senha_hash IN (crypt('admin123', senha_hash), crypt('moto123', senha_hash)) ELSE false END;

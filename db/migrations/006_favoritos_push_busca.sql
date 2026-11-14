-- 006: favoritos, notificação push para a loja e busca sem acento / tolerante a erro

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  produto_id  uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, produto_id)
);

-- um registro por aparelho (endpoint do navegador)
CREATE TABLE IF NOT EXISTS push_inscricoes (
  id          bigserial PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  aparelho    text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  ultimo_envio timestamptz
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

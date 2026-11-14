-- 004: recuperação de senha, geolocalização/rota otimizada, comprovação de entrega

CREATE TABLE IF NOT EXISTS codigos_acesso (
  id           bigserial PRIMARY KEY,
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash  text NOT NULL,
  expira_em    timestamptz NOT NULL,
  tentativas   int NOT NULL DEFAULT 0,
  usado_em     timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS codigos_acesso_usuario_idx ON codigos_acesso(usuario_id, criado_em DESC);

-- coordenadas do endereço de entrega (geocodificadas ao montar a rota)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE enderecos ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE enderecos ADD COLUMN IF NOT EXISTS lng double precision;

-- resumo da rota otimizada
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS distancia_m int;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS duracao_s int;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS otimizada_por text;   -- google | osrm | cep

-- comprovação de entrega
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprovante_url text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recebido_por text;

INSERT INTO configuracoes (chave, valor) VALUES
  ('loja_lat', ''),
  ('loja_lng', ''),
  ('comprovante_obrigatorio', 'false')
ON CONFLICT (chave) DO NOTHING;

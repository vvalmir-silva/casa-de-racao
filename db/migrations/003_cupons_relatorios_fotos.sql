-- 003: cupons de desconto, custo do produto (margem), desconto no pedido

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo_centavos int;

CREATE TABLE IF NOT EXISTS cupons (
  id               serial PRIMARY KEY,
  codigo           text NOT NULL UNIQUE,
  descricao        text,
  tipo             text NOT NULL CHECK (tipo IN ('percentual','fixo','frete_gratis')),
  valor            int NOT NULL DEFAULT 0,          -- % (percentual) ou centavos (fixo)
  minimo_centavos  int NOT NULL DEFAULT 0,
  primeira_compra  boolean NOT NULL DEFAULT false,
  limite_usos      int,                             -- NULL = ilimitado
  usos             int NOT NULL DEFAULT 0,
  valido_ate       date,
  ativo            boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupom_codigo text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_centavos int NOT NULL DEFAULT 0;

INSERT INTO cupons (codigo, descricao, tipo, valor, minimo_centavos, primeira_compra) VALUES
  ('BEMVINDO10', '10% na primeira compra', 'percentual', 10, 5000, true)
ON CONFLICT (codigo) DO NOTHING;

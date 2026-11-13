-- Casa de Ração — esquema Postgres (Neon)
-- Valores monetários em centavos (inteiro). Pesos em kg (numeric).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  telefone    text NOT NULL UNIQUE,
  email       text UNIQUE,
  senha_hash  text NOT NULL,
  papel       text NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente','admin','motorista')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enderecos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  apelido      text NOT NULL DEFAULT 'Casa',
  cep          char(8) NOT NULL,
  logradouro   text NOT NULL,
  numero       text NOT NULL,
  complemento  text,
  bairro       text NOT NULL,
  cidade       text NOT NULL,
  uf           char(2) NOT NULL,
  referencia   text,
  padrao       boolean NOT NULL DEFAULT false,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enderecos_usuario_idx ON enderecos(usuario_id);

CREATE TABLE IF NOT EXISTS categorias (
  id       serial PRIMARY KEY,
  nome     text NOT NULL,
  slug     text NOT NULL UNIQUE,
  especie  text NOT NULL CHECK (especie IN ('cao','gato','ave','outro')),
  ordem    int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produtos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id   int NOT NULL REFERENCES categorias(id),
  nome           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  marca          text,
  descricao      text,
  peso_kg        numeric(6,2) NOT NULL DEFAULT 0,
  preco_centavos int NOT NULL CHECK (preco_centavos >= 0),
  estoque        int NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  imagem_url     text,
  ativo          boolean NOT NULL DEFAULT true,
  destaque       boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON produtos(categoria_id) WHERE ativo;

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id          bigserial PRIMARY KEY,
  produto_id  uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  delta       int NOT NULL,
  motivo      text NOT NULL,
  pedido_id   uuid,
  usuario_id  uuid REFERENCES usuarios(id),
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS estoque_mov_produto_idx ON estoque_movimentos(produto_id, criado_em DESC);

-- Zonas de entrega: prefixos de CEP (5 dígitos) + dias da semana (0=dom .. 6=sáb)
CREATE TABLE IF NOT EXISTS zonas (
  id             serial PRIMARY KEY,
  nome           text NOT NULL,
  taxa_centavos  int NOT NULL DEFAULT 0,
  dias_entrega   int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  ativa          boolean NOT NULL DEFAULT true,
  ordem          int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS zona_ceps (
  id       serial PRIMARY KEY,
  zona_id  int NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  prefixo  char(5) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS zona_ceps_zona_idx ON zona_ceps(zona_id);

CREATE TABLE IF NOT EXISTS janelas (
  id       serial PRIMARY KEY,
  zona_id  int NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
  corte    time NOT NULL,   -- pedidos até este horário entram na janela de hoje
  inicio   time NOT NULL,
  fim      time NOT NULL,
  ativa    boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS janelas_zona_idx ON janelas(zona_id);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave  text PRIMARY KEY,
  valor  text NOT NULL
);

CREATE TABLE IF NOT EXISTS rotas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data          date NOT NULL,
  motorista_id  uuid REFERENCES usuarios(id),
  zona_id       int REFERENCES zonas(id),
  status        text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','em_andamento','concluida')),
  iniciada_em   timestamptz,
  concluida_em  timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rotas_data_idx ON rotas(data);

CREATE TABLE IF NOT EXISTS assinaturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endereco_id    uuid NOT NULL REFERENCES enderecos(id),
  produto_id     uuid NOT NULL REFERENCES produtos(id),
  qtd            int NOT NULL DEFAULT 1 CHECK (qtd > 0),
  intervalo_dias int NOT NULL DEFAULT 30 CHECK (intervalo_dias BETWEEN 7 AND 120),
  proxima_data   date NOT NULL,
  forma_pagamento text NOT NULL DEFAULT 'pix',
  ativa          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assinaturas_proxima_idx ON assinaturas(proxima_data) WHERE ativa;

CREATE TABLE IF NOT EXISTS pedidos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           serial UNIQUE,
  cliente_id       uuid NOT NULL REFERENCES usuarios(id),
  endereco         jsonb,                     -- snapshot do endereço (null para retirada)
  tipo_entrega     text NOT NULL CHECK (tipo_entrega IN ('retirada','rota','expresso')),
  zona_id          int REFERENCES zonas(id),
  janela_id        int REFERENCES janelas(id),
  data_entrega     date,
  peso_total_kg    numeric(8,2) NOT NULL DEFAULT 0,
  subtotal_centavos int NOT NULL,
  frete_centavos   int NOT NULL DEFAULT 0,
  total_centavos   int NOT NULL,
  forma_pagamento  text NOT NULL CHECK (forma_pagamento IN ('pix','dinheiro','cartao_entrega')),
  troco_para_centavos int,
  status           text NOT NULL DEFAULT 'aguardando_pagamento'
                   CHECK (status IN ('aguardando_pagamento','pago','separado','em_rota','entregue','cancelado')),
  observacoes      text,
  rota_id          uuid REFERENCES rotas(id) ON DELETE SET NULL,
  ordem_rota       int,
  assinatura_id    uuid REFERENCES assinaturas(id) ON DELETE SET NULL,
  entregue_em      timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_cliente_idx ON pedidos(cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS pedidos_data_status_idx ON pedidos(data_entrega, status);
CREATE INDEX IF NOT EXISTS pedidos_rota_idx ON pedidos(rota_id, ordem_rota);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id             bigserial PRIMARY KEY,
  pedido_id      uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id     uuid NOT NULL REFERENCES produtos(id),
  nome           text NOT NULL,
  preco_centavos int NOT NULL,
  qtd            int NOT NULL CHECK (qtd > 0),
  peso_kg        numeric(6,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pedido_itens_pedido_idx ON pedido_itens(pedido_id);

-- atualizado_em automático
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS produtos_atualizado ON produtos;
CREATE TRIGGER produtos_atualizado BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
DROP TRIGGER IF EXISTS pedidos_atualizado ON pedidos;
CREATE TRIGGER pedidos_atualizado BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

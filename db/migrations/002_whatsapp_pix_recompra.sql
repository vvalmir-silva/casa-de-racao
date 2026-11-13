-- 002: notificações WhatsApp, pagamentos PIX (Mercado Pago), lembrete de recompra

CREATE TABLE IF NOT EXISTS notificacoes (
  id          bigserial PRIMARY KEY,
  pedido_id   uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  telefone    text NOT NULL,
  tipo        text NOT NULL,   -- pedido_recebido, pagamento_confirmado, em_rota, entregue, novo_pedido_admin, recompra, ...
  mensagem    text NOT NULL,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviada','erro','desativado')),
  erro        text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notificacoes_pedido_idx ON notificacoes(pedido_id);
CREATE INDEX IF NOT EXISTS notificacoes_tipo_usuario_idx ON notificacoes(tipo, usuario_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS pagamentos_pix (
  id              bigserial PRIMARY KEY,
  pedido_id       uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  provedor        text NOT NULL DEFAULT 'mercadopago',
  externo_id      text NOT NULL UNIQUE,
  valor_centavos  int NOT NULL,
  qr_code         text,          -- copia e cola
  qr_code_base64  text,          -- imagem PNG
  status          text NOT NULL DEFAULT 'pending',
  expira_em       timestamptz,
  pago_em         timestamptz,
  payload         jsonb,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pagamentos_pix_pedido_idx ON pagamentos_pix(pedido_id);

-- duração estimada do produto (dias) para lembrete de recompra; NULL = não lembrar
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS duracao_dias int;

-- cliente pode desativar lembretes
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aceita_lembretes boolean NOT NULL DEFAULT true;

INSERT INTO configuracoes (chave, valor) VALUES
  ('recompra_dias_antes', '3'),
  ('whatsapp_notificacoes', 'true'),
  ('pix_expiracao_minutos', '60')
ON CONFLICT (chave) DO NOTHING;

-- estimativa inicial: 1 kg de ração ≈ 2 dias (cão médio / gato); ajuste por produto no admin
UPDATE produtos SET duracao_dias = GREATEST(7, ROUND(peso_kg * 2))
WHERE duracao_dias IS NULL AND peso_kg >= 1 AND categoria_id IN (SELECT id FROM categorias WHERE especie IN ('cao','gato'));

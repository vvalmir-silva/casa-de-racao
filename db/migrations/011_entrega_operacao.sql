-- 011: custo da entrega, acerto de caixa do motorista, confirmação de presença e limite de troco

INSERT INTO configuracoes (chave, valor) VALUES
  ('custo_entrega_centavos', '0'),     -- quanto custa cada parada da rota (motoboy por entrega, combustível…)
  ('custo_rota_centavos', '0'),        -- custo fixo por rota (diária do entregador), dividido entre as paradas
  ('custo_expresso_centavos', '0'),    -- custo médio de uma entrega expressa (app de entrega)
  ('troco_maximo_centavos', '10000'),  -- troco máximo que o entregador leva (0 = sem limite)
  ('confirmacao_automatica', 'true')   -- pede confirmação de presença no WhatsApp ao montar a rota
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS acertos_caixa (
  rota_id            uuid PRIMARY KEY REFERENCES rotas(id) ON DELETE CASCADE,
  esperado_dinheiro  int NOT NULL,
  esperado_cartao    int NOT NULL,
  recebido_dinheiro  int NOT NULL,
  recebido_cartao    int NOT NULL,
  observacao         text,
  conferido_por      uuid REFERENCES usuarios(id),
  conferido_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS confirmacao text CHECK (confirmacao IN ('sim', 'nao'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS confirmacao_em timestamptz;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS confirmacao_pedida_em timestamptz;

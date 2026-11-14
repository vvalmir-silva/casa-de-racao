-- 010: proteções contra PIX não pago, retirada não buscada e entrega recusada

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_motivo text;      -- cliente | loja | pix_expirado | nao_retirado | nao_recebido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS lembrete_retirada_em timestamptz;
CREATE INDEX IF NOT EXISTS pedidos_pendencias_idx ON pedidos(status, forma_pagamento, criado_em) WHERE status IN ('aguardando_pagamento', 'pago', 'separado');

INSERT INTO configuracoes (chave, valor) VALUES
  ('retirada_prazo_cancelar_horas', '48'),   -- "pagar na loja" não retirado: cancela e devolve estoque
  ('retirada_lembrete_horas', '24'),         -- lembrete no WhatsApp antes de cancelar
  ('pagar_depois_min_pedidos', '1'),         -- pedidos entregues antes de liberar pagar na entrega/loja (0 = libera para todos)
  ('pagar_depois_max_centavos', '30000'),    -- acima disso, só PIX (0 = sem limite)
  ('faltas_bloqueio', '2')                   -- faltas (não retirou / não recebeu) que deixam o cliente só com PIX (0 = nunca)
ON CONFLICT (chave) DO NOTHING;

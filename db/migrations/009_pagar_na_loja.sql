-- 009: retirada pode ser paga na loja (dinheiro, cartão ou PIX no balcão)
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_forma_pagamento_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_forma_pagamento_check CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao_entrega', 'na_loja'));

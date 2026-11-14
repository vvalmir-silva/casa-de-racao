-- 007: preço "de" (oferta) e parcelamento exibido no card

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_de_centavos int CHECK (preco_de_centavos IS NULL OR preco_de_centavos > 0);

INSERT INTO configuracoes (chave, valor) VALUES
  ('parcelas_max', '1'),                 -- 1 = não mostra parcelamento
  ('parcela_minima_centavos', '3000'),
  ('loja_instagram', ''),
  ('loja_horario', ''),
  ('loja_cnpj', '')
ON CONFLICT (chave) DO NOTHING;

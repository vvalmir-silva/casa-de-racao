-- 012: perfil do pet (ração indicada e duração do saco) e "indique e ganhe"

CREATE TABLE IF NOT EXISTS pets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  especie     text NOT NULL CHECK (especie IN ('cao', 'gato', 'ave', 'outro')),
  fase        text NOT NULL DEFAULT 'adulto' CHECK (fase IN ('filhote', 'adulto', 'senior')),
  peso_kg     numeric(5,2) CHECK (peso_kg IS NULL OR (peso_kg > 0 AND peso_kg <= 120)),
  castrado    boolean NOT NULL DEFAULT false,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pets_usuario_idx ON pets(usuario_id);

-- Consumo diário estimado de ração seca (g/dia). Mesma fórmula de src/lib/pets.ts.
CREATE OR REPLACE FUNCTION consumo_pet_g(especie text, peso numeric, fase text, castrado boolean) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN peso IS NULL OR peso <= 0 OR especie NOT IN ('cao', 'gato') THEN NULL
    ELSE round(
      (CASE WHEN especie = 'cao' THEN 130 * power(peso, 0.75) ELSE 100 * power(peso, 0.67) END) / 3.6
      * (CASE fase WHEN 'filhote' THEN 1.6 WHEN 'senior' THEN 0.85 ELSE 1 END)
      * (CASE WHEN castrado AND fase <> 'filhote' THEN 0.85 ELSE 1 END)
    )
  END
$$;

-- Indicação
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_indicacao text UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS indicado_por uuid REFERENCES usuarios(id);

ALTER TABLE cupons ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE; -- cupom pessoal
ALTER TABLE cupons ADD COLUMN IF NOT EXISTS origem text;                                                 -- indicacao_amigo | indicacao_premio
CREATE INDEX IF NOT EXISTS cupons_usuario_idx ON cupons(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS indicacoes (
  indicado_id    uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  indicador_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pedido_id      uuid REFERENCES pedidos(id),
  cupom_premio   text,
  status         text NOT NULL DEFAULT 'cadastrou' CHECK (status IN ('cadastrou', 'premiado', 'recusado')),
  motivo         text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  premiado_em    timestamptz
);
CREATE INDEX IF NOT EXISTS indicacoes_indicador_idx ON indicacoes(indicador_id);

INSERT INTO configuracoes (chave, valor) VALUES
  ('indicacao_ativa', 'true'),
  ('indicacao_desconto_centavos', '1000'),  -- amigo ganha na 1ª compra
  ('indicacao_premio_centavos', '1000'),    -- quem indicou ganha quando o amigo recebe o 1º pedido
  ('indicacao_minimo_centavos', '5000')     -- pedido mínimo para usar os cupons
ON CONFLICT (chave) DO NOTHING;

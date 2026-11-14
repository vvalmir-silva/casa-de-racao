-- 008: carrinho salvo no servidor (cliente logado) para continuar em outro aparelho e lembrar quem desistiu

CREATE TABLE IF NOT EXISTS carrinhos (
  usuario_id    uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  itens         jsonb NOT NULL DEFAULT '[]',     -- [{ "id": uuid, "qtd": int }]
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  lembrado_em   timestamptz
);
CREATE INDEX IF NOT EXISTS carrinhos_atualizado_idx ON carrinhos(atualizado_em);

INSERT INTO configuracoes (chave, valor) VALUES ('carrinho_lembrete_horas', '20')
ON CONFLICT (chave) DO NOTHING;

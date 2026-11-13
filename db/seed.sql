-- Seed inicial — ajuste zonas/CEPs e troque as senhas no primeiro acesso.

INSERT INTO configuracoes (chave, valor) VALUES
  ('loja_nome', 'Casa de Ração'),
  ('loja_endereco', 'Rua da Loja, 100 - São Paulo/SP'),
  ('loja_cep', '01000000'),
  ('loja_whatsapp', '5511999999999'),
  ('pix_chave', 'sua-chave-pix@exemplo.com'),
  ('frete_gratis_minimo_centavos', '15000'),
  ('peso_extra_limite_kg', '30'),
  ('peso_extra_taxa_centavos', '500'),
  ('peso_extra_bloco_kg', '15'),
  ('expresso_ativo', 'true'),
  ('expresso_taxa_centavos', '1800'),
  ('expresso_peso_max_kg', '5'),
  ('expresso_prazo_horas', '2'),
  ('retirada_prazo_horas', '1')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO zonas (id, nome, taxa_centavos, dias_entrega, ordem) VALUES
  (1, 'Zona 1 — até 3 km',  600,  '{1,2,3,4,5,6}', 1),
  (2, 'Zona 2 — 3 a 8 km',  1000, '{1,3,5}',       2),
  (3, 'Zona 3 — 8 a 15 km', 1500, '{2,4}',         3)
ON CONFLICT (id) DO NOTHING;
SELECT setval('zonas_id_seq', (SELECT max(id) FROM zonas));

-- Prefixos de exemplo (5 primeiros dígitos do CEP). Edite no painel admin.
INSERT INTO zona_ceps (zona_id, prefixo) VALUES
  (1,'01000'),(1,'01001'),(1,'01002'),(1,'01003'),(1,'01004'),
  (2,'01100'),(2,'01200'),(2,'01300'),(2,'01400'),(2,'01500'),
  (3,'02000'),(3,'03000'),(3,'04000'),(3,'05000')
ON CONFLICT (prefixo) DO NOTHING;

INSERT INTO janelas (zona_id, corte, inicio, fim) VALUES
  (1, '15:00', '18:00', '21:00'),
  (2, '15:00', '18:00', '21:00'),
  (3, '15:00', '18:00', '21:00');

INSERT INTO categorias (nome, slug, especie, ordem) VALUES
  ('Ração para Cães',  'racao-caes',  'cao',  1),
  ('Ração para Gatos', 'racao-gatos', 'gato', 2),
  ('Ração para Aves',  'racao-aves',  'ave',  3),
  ('Petiscos',         'petiscos',    'outro',4),
  ('Areia e Higiene',  'higiene',     'gato', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO produtos (categoria_id, nome, slug, marca, descricao, peso_kg, preco_centavos, estoque, destaque) VALUES
  ((SELECT id FROM categorias WHERE slug='racao-caes'),  'Ração Premium Cães Adultos 15 kg', 'racao-premium-caes-adultos-15kg', 'Golden', 'Frango e arroz. Cães adultos de todos os portes.', 15, 17990, 20, true),
  ((SELECT id FROM categorias WHERE slug='racao-caes'),  'Ração Cães Filhotes 10 kg', 'racao-caes-filhotes-10kg', 'Premier', 'Fórmula para filhotes até 12 meses.', 10, 21990, 12, false),
  ((SELECT id FROM categorias WHERE slug='racao-caes'),  'Ração Cães Adultos 3 kg', 'racao-caes-adultos-3kg', 'Golden', 'Embalagem pequena.', 3, 5490, 30, false),
  ((SELECT id FROM categorias WHERE slug='racao-gatos'), 'Ração Gatos Castrados 10 kg', 'racao-gatos-castrados-10kg', 'Whiskas', 'Controle de peso e trato urinário.', 10, 18990, 15, true),
  ((SELECT id FROM categorias WHERE slug='racao-gatos'), 'Ração Gatos Adultos 3 kg', 'racao-gatos-adultos-3kg', 'Golden', 'Sabor salmão.', 3, 6990, 25, false),
  ((SELECT id FROM categorias WHERE slug='racao-gatos'), 'Sachê Gatos 85 g (cx 12)', 'sache-gatos-85g-cx12', 'Whiskas', 'Caixa com 12 sachês sortidos.', 1.1, 3990, 40, false),
  ((SELECT id FROM categorias WHERE slug='racao-aves'),  'Mistura para Calopsita 500 g', 'mistura-calopsita-500g', 'Alcon', 'Sementes selecionadas.', 0.5, 1890, 30, false),
  ((SELECT id FROM categorias WHERE slug='racao-aves'),  'Ração Extrusada Papagaio 700 g', 'racao-papagaio-700g', 'Nutrópica', 'Extrusada completa.', 0.7, 3290, 18, false),
  ((SELECT id FROM categorias WHERE slug='racao-aves'),  'Alpiste 1 kg', 'alpiste-1kg', 'Granel', 'Para canários e periquitos.', 1, 1290, 50, false),
  ((SELECT id FROM categorias WHERE slug='petiscos'),    'Bifinho Cães 500 g', 'bifinho-caes-500g', 'Keldog', 'Sabor carne.', 0.5, 1990, 35, false),
  ((SELECT id FROM categorias WHERE slug='higiene'),     'Areia Sanitária 4 kg', 'areia-sanitaria-4kg', 'Pipicat', 'Granulada, alta absorção.', 4, 1890, 40, false)
ON CONFLICT (slug) DO NOTHING;

-- Usuários iniciais (senhas: admin123 / moto123). TROQUE após o primeiro login.
INSERT INTO usuarios (nome, telefone, email, senha_hash, papel) VALUES
  ('Administrador', '11999999999', 'admin@casaderacao.local', crypt('admin123', gen_salt('bf', 10)), 'admin'),
  ('Motorista',     '11988888888', 'motorista@casaderacao.local', crypt('moto123', gen_salt('bf', 10)), 'motorista')
ON CONFLICT (telefone) DO NOTHING;

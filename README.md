# Casa de Ração — loja online com entrega por zonas

Sistema de vendas que usa o estoque físico da loja (modelo dropship local): catálogo, carrinho,
checkout com cálculo de frete por zona de CEP e janela de entrega, PIX/dinheiro/cartão na entrega,
assinaturas recorrentes, painel admin (produtos, estoque, pedidos, rotas, zonas) e painel do motorista.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind · Neon Postgres · Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL e SESSION_SECRET
npm run db:schema            # cria as tabelas (idempotente)
npm run db:seed              # dados iniciais (já aplicado no banco criado)
npm run dev                  # http://localhost:3000
# Postgres local em vez do Neon: DB_DRIVER=pg no .env
```

Acessos iniciais (troque em **Admin → Usuários**):

| Papel     | Telefone      | Senha     |
|-----------|---------------|-----------|
| Admin     | 11999999999   | admin123  |
| Motorista | 11988888888   | moto123   |

## Deploy na Vercel

1. Suba o repositório no GitHub e importe na Vercel.
2. Variáveis de ambiente: `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -base64 32`), `CRON_SECRET`.
3. O `vercel.json` já agenda o cron de assinaturas (`/api/cron/assinaturas`, diário às 09:00 UTC = 06:00 BRT).
4. Node 22 (padrão da Vercel) — necessário para o `Pool` WebSocket do Neon.

## Testes

```bash
npm test                 # unitários (frete, datas, rota)
npm run test:e2e         # ponta a ponta com Playwright (precisa de Postgres local; ver playwright.config.ts)
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tipos, unitários, build e E2E a cada push, com Postgres de teste.

## Integrações (opcionais, via variáveis de ambiente)

| Recurso | Variáveis | Sem configurar |
|---|---|---|
| WhatsApp automático (pedido, pagamento, saiu p/ entrega, entregue, lembrete de recompra) | `WHATSAPP_PROVIDER=evolution` + `WHATSAPP_API_URL/KEY/INSTANCE`, ou `=zapi` + `ZAPI_INSTANCE/TOKEN/CLIENT_TOKEN` | Mensagens ficam registradas em Admin → Notificações como "desativado" |
| PIX automático com QR Code e confirmação | `MP_ACCESS_TOKEN` (Mercado Pago) e, opcional, `MP_WEBHOOK_SECRET`. Cadastre o webhook `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento *Pagamentos*) | Cliente vê a chave PIX manual e o admin confirma |
| Links nas mensagens | `NEXT_PUBLIC_SITE_URL` | Sem link |
| Rota otimizada | `GOOGLE_MAPS_API_KEY` (opcional, mais preciso). Sem chave usa OpenStreetMap (Nominatim + OSRM), grátis | Ordem por distância estimada ou por CEP |
| Recuperar senha | Usa o WhatsApp configurado | Tela orienta a falar com a loja; admin troca a senha em Usuários |
| Upload de fotos de produto | `BLOB_READ_WRITE_TOKEN` (Vercel Blob, criado automaticamente ao conectar o store) | Só URL da imagem |
| Monitoramento de erros | `NEXT_PUBLIC_SENTRY_DSN` (Sentry, projeto `casa-de-racao`). Opcional: `SENTRY_AUTH_TOKEN` para enviar source maps | Erros só nos logs da Vercel |
| Aviso de pedido novo no celular da loja (Web Push) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gere com `npx web-push generate-vapid-keys`). Ative em Admin → Resumo em cada aparelho; no iPhone, só com o app instalado | O card não aparece |
| Visitas e velocidade | Ative *Web Analytics* e *Speed Insights* no painel do projeto na Vercel (o código já está pronto) | Nada é coletado |

**Migrações:** novas alterações de banco ficam em `db/migrations/*.sql`. Aplique com `npm run db:migrate` ou acessando `/api/admin/migrar` logado como admin.

**Crons (vercel.json):** `/api/cron/assinaturas` (06h BRT) e `/api/cron/recompra` (10h BRT).

## Vender mais

- **Complete o frete grátis:** no carrinho, quando falta pouco para o frete grátis, aparecem produtos com preço perto do que falta (`/api/complemento`).
- **Carrinho salvo e lembrete:** para cliente logado, o carrinho é guardado no servidor (tabela `carrinhos`) e volta em outro aparelho. O cron diário de recompra (10h BRT) também manda WhatsApp para quem deixou itens há mais de `carrinho_lembrete_horas` (padrão 20h, até 7 dias), uma vez por carrinho, respeitando “Lembretes no WhatsApp” em Minha conta.
- **Planilha de produtos:** Admin → Produtos → “Importar planilha”. Baixe o modelo (já com os produtos atuais), edite no Excel/Google Planilhas e envie .xlsx ou .csv. Prévia com novos/atualizar/erros antes de gravar; estoque ajustado entra no histórico de movimentos.

## Layout da loja

- **Cores:** azul-petróleo (`pine`, cor principal) e tangerina (`kibble`, destaque), vermelho `oferta` para descontos. Tokens em `tailwind.config.ts`.
- **Topo:** faixa de avisos rotativa (montada das Configurações: frete grátis, horário de corte), busca larga com sugestões, CEP, conta, favoritos e carrinho com total; menu de departamentos no desktop e gaveta lateral no celular.
- **Banner principal:** carrossel com troca a cada 6s, setas, bolinhas, arrastar e botão de pausa; não troca sozinho com "reduzir movimento".
- **Ofertas:** preencha "Preço de" no produto para aparecer riscado, com selo de % e na seção "Ofertas da semana" (`/?ofertas=1`). Parcelamento no card só aparece se "Parcelamento no cartão" > 1 em Configurações.
- **Rodapé:** departamentos, atendimento (WhatsApp/horário), pagamentos, Instagram, CNPJ — tudo das Configurações. Página `/como-funciona` com zonas, horários e regras reais.

## Endereço e etiquetas

- **Complemento:** no checkout e em Minha conta o cliente informa apto/bloco ou marca "É casa, sem complemento" (grava "Casa"). Validação também no servidor.
- **Etiquetas:** `/admin/etiquetas` (pedidos pagos do dia), `?rota=ID` (botão 🏷️ em cada rota) ou `?pedido=ID` (link em Pedidos). Folha A4 (2 por linha) ou térmica 10×15. Mostra nº do pedido grande, parada, cliente, complemento em destaque e quanto receber.
- **Mesmo endereço:** pedidos com mesmo CEP + número na rota aparecem com aviso na tela do motorista, no painel de rotas e na etiqueta.

## Busca, favoritos e comprar de novo

- **Busca:** ignora acento e maiúsculas, tolera erro de digitação (pg_trgm) e entende "cachorro" → cães, "pássaro" → aves etc. (`src/lib/busca.ts`). Sugestões aparecem enquanto digita (`/api/busca`).
- **Favoritos:** coração no card e na página do produto; lista em `/conta/favoritos` e carrossel na home.
- **Comprar de novo:** botão no pedido e em Minha conta (último pedido entregue) que põe os itens no carrinho com preço e estoque de hoje; carrossel "Comprar de novo" na home para quem já comprou.

## Avaliações e SEO

- **Avaliação pós-entrega:** ao marcar "entregue", o WhatsApp leva o link `…/conta/pedido/ID#avaliar`. O cliente dá de 1 a 5 estrelas e comenta. Notas 4–5 com comentário vão para a página inicial ("Quem compra, recomenda"), salvo se desligado em Configurações. **Admin → Avaliações:** média, notas baixas, responder, tirar ou pôr na vitrine.
- **SEO:** `/sitemap.xml`, `/robots.txt` (painel, conta e checkout fora do Google), título e descrição por produto e categoria, imagem de compartilhamento (`/opengraph-image`) e dados estruturados (`PetStore` com nota média, `Product` com preço e estoque).
- **Senha inicial:** enquanto `admin123`/`moto123` estiverem em uso, o painel mostra um alerta vermelho.

## Cupons e relatórios

- **Admin → Cupons:** percentual, valor fixo ou frete grátis; pedido mínimo, limite de usos, validade, só primeira compra. Seed: `BEMVINDO10`.
- **Admin → Relatórios:** receita, ticket médio, margem bruta (preencha o custo nos produtos), receita por dia, top produtos, por pagamento/entrega/zona, cupons usados.

## Como funciona a entrega

- **Zonas** = conjuntos de prefixos de CEP (5 dígitos) com taxa e dias da semana de entrega.
- **Janelas** = horário de corte + período de entrega (ex.: pedidos até 15h chegam 18h–21h).
- **Data prevista**: se hoje é dia de entrega da zona e ainda não passou o corte → hoje; senão, próximo dia de entrega.
- **Frete em rota**: `taxa da zona` (zerada acima do mínimo de frete grátis) `+ adicional por peso` (acima de 30 kg, R$ 5 a cada 15 kg).
- **Expresso**: motoboy sob demanda para pedidos leves (≤ 5 kg), taxa fixa.
- **Retirada**: sempre grátis.
- Tudo configurável em **Admin → Zonas e janelas** e **Admin → Configurações**.

## Fluxo do pedido

`aguardando_pagamento` (PIX) → `pago` → `separado` → `em_rota` → `entregue` (ou `cancelado`, que devolve o estoque).
Pedidos em dinheiro/cartão nascem como `pago`. O estoque é baixado na criação do pedido, em transação.

## Rotas

Admin → Rotas: lista pedidos pagos sem rota até a data, cria rota (ordenada por CEP), atribui motorista.
Motorista → Minha rota: inicia a rota, vê a próxima parada, abre Maps/Waze/WhatsApp, reordena e marca entregue.

## Assinaturas

Cliente escolhe produto, quantidade, intervalo (15–60 dias) e endereço. O cron gera o pedido 2 dias antes
da data, na primeira janela da zona do endereço, e avança a próxima data. Sem estoque → tenta de novo no dia seguinte.

## Estrutura

```
db/schema.sql, db/seed.sql     esquema e dados iniciais
src/lib/frete.ts               motor de frete/zonas/janelas
src/lib/pedidos.ts             criação/cancelamento de pedido (transação, estoque)
src/lib/auth.ts                sessão JWT em cookie + bcrypt
src/app/                       loja, conta, checkout, admin, motorista, api
```

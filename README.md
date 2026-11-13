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

## Integrações (opcionais, via variáveis de ambiente)

| Recurso | Variáveis | Sem configurar |
|---|---|---|
| WhatsApp automático (pedido, pagamento, saiu p/ entrega, entregue, lembrete de recompra) | `WHATSAPP_PROVIDER=evolution` + `WHATSAPP_API_URL/KEY/INSTANCE`, ou `=zapi` + `ZAPI_INSTANCE/TOKEN/CLIENT_TOKEN` | Mensagens ficam registradas em Admin → Notificações como "desativado" |
| PIX automático com QR Code e confirmação | `MP_ACCESS_TOKEN` (Mercado Pago) e, opcional, `MP_WEBHOOK_SECRET`. Cadastre o webhook `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento *Pagamentos*) | Cliente vê a chave PIX manual e o admin confirma |
| Links nas mensagens | `NEXT_PUBLIC_SITE_URL` | Sem link |
| Upload de fotos de produto | `BLOB_READ_WRITE_TOKEN` (Vercel Blob, criado automaticamente ao conectar o store) | Só URL da imagem |

**Migrações:** novas alterações de banco ficam em `db/migrations/*.sql`. Aplique com `npm run db:migrate` ou acessando `/api/admin/migrar` logado como admin.

**Crons (vercel.json):** `/api/cron/assinaturas` (06h BRT) e `/api/cron/recompra` (10h BRT).

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

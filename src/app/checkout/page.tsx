import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";
import { sql, getConfig } from "@/lib/db";
import { CheckoutForm, type EnderecoSalvo } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const s = await getSessao();
  if (!s) redirect("/login?next=/checkout");
  const enderecos = (await sql`
    SELECT id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia, padrao
    FROM enderecos WHERE usuario_id = ${s.id} ORDER BY padrao DESC, criado_em DESC
  `) as EnderecoSalvo[];
  const cfg = await getConfig();
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Finalizar pedido</h1>
      <CheckoutForm enderecos={enderecos} pixChave={cfg.pix_chave ?? ""} lojaEndereco={cfg.loja_endereco ?? ""} freteGratisMinimo={Number(cfg.frete_gratis_minimo_centavos ?? 0)} />
    </div>
  );
}

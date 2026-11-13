"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAction } from "@/components/FormAction";
import { salvarProduto, ajustarEstoque, salvarCategoria } from "../actions";
import type { Prod } from "./page";

export function ProdutoForm({ produto, categorias }: { produto: Prod | null; categorias: { id: number; nome: string }[] }) {
  const router = useRouter();
  return (
    <FormAction action={salvarProduto} className="card grid grid-cols-2 gap-2 sm:grid-cols-4" onOk={() => router.push("/admin/produtos")}>
      <h2 className="col-span-full font-semibold">{produto ? "Editar produto" : "Novo produto"}</h2>
      <input type="hidden" name="id" value={produto?.id ?? ""} />
      <div className="col-span-2"><label className="label">Nome</label><input name="nome" className="input" defaultValue={produto?.nome} required /></div>
      <div><label className="label">Marca</label><input name="marca" className="input" defaultValue={produto?.marca ?? ""} /></div>
      <div><label className="label">Categoria</label><select name="categoria_id" className="input" defaultValue={produto?.categoria_id}>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
      <div><label className="label">Peso (kg)</label><input name="peso_kg" className="input" inputMode="decimal" defaultValue={produto ? Number(produto.peso_kg) : ""} required /></div>
      <div><label className="label">Preço (R$)</label><input name="preco" className="input" inputMode="decimal" defaultValue={produto ? (produto.preco_centavos / 100).toFixed(2).replace(".", ",") : ""} required /></div>
      <div><label className="label">Dura (dias) · lembrete</label><input name="duracao_dias" className="input" inputMode="numeric" defaultValue={produto?.duracao_dias ?? ""} placeholder="ex.: 30" /></div>
      <div className="col-span-2"><label className="label">URL da imagem</label><input name="imagem_url" className="input" defaultValue={produto?.imagem_url ?? ""} placeholder="https://..." /></div>
      <div className="col-span-full"><label className="label">Descrição</label><textarea name="descricao" className="input" rows={2} defaultValue={produto?.descricao ?? ""} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={produto?.ativo ?? true} /> Ativo</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="destaque" defaultChecked={produto?.destaque ?? false} /> Destaque</label>
      <div className="col-span-full flex gap-2"><button className="btn-primary">Salvar</button><a href="/admin/produtos" className="btn-ghost">Cancelar</a></div>
    </FormAction>
  );
}

export function EstoqueAjuste({ id }: { id: string }) {
  const [v, setV] = useState("");
  const router = useRouter();
  async function aplicar(sinal: 1 | -1) {
    const n = Math.abs(parseInt(v, 10));
    if (!n) return;
    const r = await ajustarEstoque(id, sinal * n, sinal > 0 ? "entrada" : "saida");
    if (r.erro) alert(r.erro); else { setV(""); router.refresh(); }
  }
  return (
    <div className="flex items-center gap-1">
      <input className="input w-16 px-2 py-1" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="qtd" />
      <button className="btn-outline px-2 py-1" onClick={() => aplicar(1)}>+</button>
      <button className="btn-outline px-2 py-1" onClick={() => aplicar(-1)}>−</button>
    </div>
  );
}

export function CategoriaForm({ categorias }: { categorias: { id: number; nome: string; especie: string }[] }) {
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Categorias ({categorias.length})</summary>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs">{categorias.map((c) => <li key={c.id} className="badge bg-stone-100">{c.nome} · {c.especie}</li>)}</ul>
      <FormAction action={salvarCategoria} className="mt-3 flex flex-wrap gap-2">
        <input name="nome" className="input w-48" placeholder="Nova categoria" required />
        <select name="especie" className="input w-32"><option value="cao">Cão</option><option value="gato">Gato</option><option value="ave">Ave</option><option value="outro">Outro</option></select>
        <button className="btn-outline">Adicionar</button>
      </FormAction>
    </details>
  );
}

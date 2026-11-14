import type { Metadata } from "next";
import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { petsDoUsuario, indicadosPorPet } from "@/lib/pets-db";
import { ProdutoCard } from "@/components/ProdutoCard";
import { duracaoDias } from "@/lib/pets";
import { PetForm } from "./PetForm";
import { PetItem } from "./PetItem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meus pets", robots: { index: false } };

export default async function PetsPage() {
  const s = await exigirSessao();
  const pets = await petsDoUsuario(s.id);
  const grupos = await indicadosPorPet(pets, 6);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Meus pets</h1>
        <Link href="/conta" className="btn-ghost ml-auto">‹ Minha conta</Link>
      </div>
      <p className="muted -mt-3">Com o peso e a idade, indicamos a ração certa e avisamos no WhatsApp quando o saco estiver acabando.</p>

      {pets.length > 0 && <ul className="grid gap-3 md:grid-cols-2">{pets.map((p) => <PetItem key={p.id} pet={p} />)}</ul>}

      <section className="card space-y-3">
        <h2 className="h2">{pets.length ? "Adicionar outro pet" : "Cadastre seu pet"}</h2>
        <PetForm />
      </section>

      {grupos.map(({ pet, itens }) => (
        <section key={pet.id} aria-labelledby={`ind-${pet.id}`}>
          <h2 id={`ind-${pet.id}`} className="h2 mb-3">Indicados para {pet.nome}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {itens.map((p, i) => {
              const d = p.peso_kg ? duracaoDias(p.peso_kg, [pet]) : null;
              return (
                <div key={p.id} className="flex flex-col gap-1">
                  <ProdutoCard p={p} i={i} />
                  {d && <span className="px-1 text-xs font-semibold text-pine-700">Dura ~{d} dias para {pet.nome}</span>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-xs text-ink-3">As quantidades são estimativas para ração seca. Siga a tabela da embalagem e a orientação do veterinário.</p>
    </div>
  );
}

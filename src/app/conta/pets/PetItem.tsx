"use client";
import { useState } from "react";
import { BotaoAction } from "@/components/FormAction";
import { consumoDiarioG, EMOJI, ESPECIE, FASE, type Pet } from "@/lib/pets";
import { excluirPet } from "./actions";
import { PetForm } from "./PetForm";

export function PetItem({ pet }: { pet: Pet }) {
  const [editando, setEditando] = useState(false);
  const g = consumoDiarioG(pet);
  return (
    <li className="card space-y-3" data-reveal>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pine-50 text-2xl" aria-hidden>{EMOJI[pet.especie]}</span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{pet.nome}</div>
          <div className="text-sm text-ink-2">
            {ESPECIE[pet.especie]}{pet.especie === "cao" || pet.especie === "gato" ? ` · ${FASE[pet.fase]}${pet.peso_kg ? ` · ${String(pet.peso_kg).replace(".", ",")} kg` : ""}${pet.castrado ? " · castrado(a)" : ""}` : ""}
          </div>
          {g && <div className="text-xs text-ink-3">~{g} g de ração por dia</div>}
        </div>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>{editando ? "Fechar" : "Editar"}</button>
      </div>
      {editando && (
        <div className="space-y-2 border-t border-line pt-3">
          <PetForm pet={pet} onOk={() => setEditando(false)} />
          <BotaoAction className="text-sm font-semibold text-red-700" action={excluirPet} args={[pet.id]} confirmar={`Remover ${pet.nome}?`}>Remover pet</BotaoAction>
        </div>
      )}
    </li>
  );
}

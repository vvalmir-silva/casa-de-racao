"use client";
import { useState } from "react";
import { FormAction } from "@/components/FormAction";
import { consumoDiarioG, ESPECIE, FASE, type Especie, type Fase, type Pet } from "@/lib/pets";
import { salvarPet } from "./actions";

export function PetForm({ pet, onOk }: { pet?: Pet; onOk?: () => void }) {
  const [especie, setEspecie] = useState<Especie>(pet?.especie ?? "cao");
  const [fase, setFase] = useState<Fase>(pet?.fase ?? "adulto");
  const [peso, setPeso] = useState(pet?.peso_kg ? String(pet.peso_kg).replace(".", ",") : "");
  const [castrado, setCastrado] = useState(pet?.castrado ?? false);
  const pre = pet?.id ?? "novo";
  const g = consumoDiarioG({ especie, fase, castrado, peso_kg: Number(peso.replace(",", ".")) || null });
  const mamifero = especie === "cao" || especie === "gato";
  return (
    <FormAction action={salvarPet} onOk={onOk} className="grid gap-3 sm:grid-cols-2">
      {pet && <input type="hidden" name="id" value={pet.id} />}
      <div><label className="label" htmlFor={`pt-nome-${pre}`}>Nome</label><input id={`pt-nome-${pre}`} name="nome" className="input" required maxLength={40} defaultValue={pet?.nome} placeholder="Thor" /></div>
      <fieldset>
        <legend className="label">Espécie</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ESPECIE) as Especie[]).map((e) => (
            <label key={e} className={`chip cursor-pointer ${especie === e ? "chip-on" : ""}`}>
              <input type="radio" name="especie" value={e} className="sr-only" checked={especie === e} onChange={() => setEspecie(e)} />{ESPECIE[e]}
            </label>
          ))}
        </div>
      </fieldset>
      {mamifero && (
        <>
          <div>
            <label className="label" htmlFor={`pt-fase-${pre}`}>Idade</label>
            <select id={`pt-fase-${pre}`} name="fase" className="input" value={fase} onChange={(e) => setFase(e.target.value as Fase)}>
              {(Object.keys(FASE) as Fase[]).map((f) => <option key={f} value={f}>{FASE[f]}{f === "filhote" ? " (até 1 ano)" : f === "senior" ? " (7 anos ou mais)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`pt-peso-${pre}`}>Peso (kg)</label>
            <input id={`pt-peso-${pre}`} name="peso_kg" className="input" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="ex.: 12,5" aria-describedby={`pt-peso-dica-${pre}`} />
            <p id={`pt-peso-dica-${pre}`} className="mt-1 text-xs text-ink-3">{g ? `Come cerca de ${g} g de ração seca por dia.` : "Com o peso, calculamos quanto tempo o saco dura."}</p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="castrado" checked={castrado} onChange={(e) => setCastrado(e.target.checked)} /> Castrado(a)</label>
        </>
      )}
      <div className="sm:col-span-2"><button className="btn-primary w-full sm:w-auto">{pet ? "Salvar" : "Adicionar pet"}</button></div>
    </FormAction>
  );
}

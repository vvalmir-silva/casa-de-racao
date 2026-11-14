import { EsqueletoCard } from "@/components/Esqueletos";

export default function CarregandoProduto() {
  return (
    <div className="space-y-10" role="status" aria-label="Carregando produto">
      <div className="esqueleto h-4 w-40 rounded-full" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="esqueleto aspect-[5/4] rounded-[32px] sm:aspect-square" />
        <div className="flex flex-col gap-4 md:py-4">
          <div className="esqueleto h-4 w-24 rounded-full" />
          <div className="esqueleto h-9 w-4/5 rounded-2xl" />
          <div className="esqueleto h-10 w-40 rounded-2xl" />
          <div className="esqueleto h-12 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-16 rounded-2xl" />)}
          </div>
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((i) => <EsqueletoCard key={i} compacto />)}</div>
    </div>
  );
}

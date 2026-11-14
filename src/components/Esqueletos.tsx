/** Esqueletos de carregamento: mesmo desenho da tela final, sem pulo quando o conteúdo chega. */
export function EsqueletoCard({ compacto }: { compacto?: boolean }) {
  return (
    <div className={`flex flex-col ${compacto ? "w-[160px] shrink-0 sm:w-[190px] lg:w-auto" : ""}`} aria-hidden>
      <div className="esqueleto aspect-square rounded-[22px]" />
      <div className="esqueleto mt-3 h-4 w-1/2 rounded-full" />
      <div className="esqueleto mt-2 h-3.5 w-4/5 rounded-full" />
    </div>
  );
}

export function EsqueletoVitrine() {
  return (
    <div className="space-y-8 sm:space-y-10" role="status" aria-label="Carregando produtos">
      <div className="esqueleto h-[230px] rounded-[28px] lg:h-[360px]" />
      <div className="flex gap-3 overflow-hidden lg:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex w-[84px] shrink-0 flex-col items-center gap-2 lg:w-[112px]">
            <div className="esqueleto aspect-square w-full rounded-[22px]" />
            <div className="esqueleto h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
      {[0, 1].map((s) => (
        <section key={s}>
          <div className="esqueleto mb-3 h-6 w-48 rounded-full" />
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:px-0">
            {Array.from({ length: 5 }).map((_, i) => <EsqueletoCard key={i} compacto />)}
          </div>
        </section>
      ))}
    </div>
  );
}

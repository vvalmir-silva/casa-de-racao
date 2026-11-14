export function SeloConfirmacao({ valor }: { valor: string | null }) {
  if (valor === "sim") return <span className="badge bg-pine-100 text-pine-800" title="Cliente confirmou que vai estar em casa">✓ confirmou</span>;
  if (valor === "nao") return <span className="badge bg-oferta-50 text-oferta" title="Cliente disse que não vai estar">✗ não vai estar</span>;
  return <span className="badge bg-page text-ink-3" title="Cliente ainda não respondeu">? sem resposta</span>;
}

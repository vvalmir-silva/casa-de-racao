"use client";

export function ImprimirBotao() {
  return <button className="btn-primary" onClick={() => window.print()}>Imprimir</button>;
}

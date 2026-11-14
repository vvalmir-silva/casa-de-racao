export const dynamic = "force-static";
export const metadata = { title: "Sem conexão" };

export default function Offline() {
  return (
    <div className="card-flat mx-auto mt-10 max-w-sm py-12 text-center">
      <div className="text-4xl">📶</div>
      <h1 className="h1 mt-3">Sem internet</h1>
      <p className="muted mt-1">Seu carrinho está salvo. Assim que a conexão voltar, é só continuar.</p>
      <a href="/" className="btn-primary mt-5">Tentar de novo</a>
    </div>
  );
}

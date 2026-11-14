import type { EnderecoCep, StatusCep } from "@/hooks/useBuscaCep";

/** Linha de retorno abaixo do campo CEP. */
export function CepStatus({ status, endereco }: { status: StatusCep; endereco: EnderecoCep | null }) {
  if (status === "vazio")
    return (
      <p className="mt-1.5 text-xs text-ink-3">
        Digite o CEP e preenchemos o endereço.{" "}
        <a className="font-semibold text-pine-700 underline" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer">Não sei meu CEP</a>
      </p>
    );
  if (status === "buscando") return <p className="mt-1.5 text-xs font-semibold text-ink-3" aria-live="polite">Buscando endereço…</p>;
  if (status === "ok" && endereco)
    return (
      <p className="mt-1.5 text-xs font-semibold text-pine-700" aria-live="polite">
        ✓ {endereco.logradouro ? `${endereco.logradouro}, ` : ""}{endereco.bairro ? `${endereco.bairro} · ` : ""}{endereco.cidade}/{endereco.uf}
        {!endereco.logradouro && <span className="block font-normal text-ink-3">CEP geral da cidade: preencha rua e bairro.</span>}
      </p>
    );
  if (status === "nao_encontrado") return <p className="mt-1.5 text-xs font-semibold text-red-700" aria-live="polite">CEP não encontrado. Confira os números ou preencha o endereço à mão.</p>;
  return <p className="mt-1.5 text-xs font-semibold text-kibble-600" aria-live="polite">Não deu para buscar o CEP agora. Preencha o endereço à mão.</p>;
}

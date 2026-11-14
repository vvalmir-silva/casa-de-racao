/** Miniatura do produto "voa" do botão até o ícone do carrinho visível (300ms, ease-in). Só transform/opacity. */
export function voarParaCarrinho(origem: Element | null, imagem?: string | null) {
  if (typeof window === "undefined" || !origem) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const alvo = [...document.querySelectorAll<HTMLElement>("[data-alvo-carrinho]")].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
  });
  if (!alvo) return;
  const a = origem.getBoundingClientRect();
  const b = alvo.getBoundingClientRect();
  const tam = 44;
  const bola = document.createElement("div");
  bola.setAttribute("aria-hidden", "true");
  Object.assign(bola.style, {
    position: "fixed", zIndex: "80", pointerEvents: "none", width: `${tam}px`, height: `${tam}px`, borderRadius: "999px",
    left: `${a.left + a.width / 2 - tam / 2}px`, top: `${a.top + a.height / 2 - tam / 2}px`,
    background: imagem ? `#fff url("${imagem}") center/cover` : "#0D4F68",
    boxShadow: "0 8px 20px -6px rgba(6,43,58,.5)", border: "2px solid #fff",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(bola);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = bola.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(.8)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0.3 },
    ],
    { duration: 300, easing: "cubic-bezier(.7,0,.84,0)" },
  );
  const fim = () => bola.remove();
  anim.onfinish = fim; anim.oncancel = fim;
}

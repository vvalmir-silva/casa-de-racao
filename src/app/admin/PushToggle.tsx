"use client";

import { useEffect, useState, useTransition } from "react";
import { salvarInscricaoPush, removerInscricaoPush, testarPush } from "./actions";

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "bloqueado" | "desligado" | "ligado" | "sem-chave";

function chaveBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function nomeAparelho() {
  const ua = navigator.userAgent;
  const so = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Navegador";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${so} ${nav}`.trim();
}

/** Liga/desliga o aviso de pedido novo neste aparelho (Web Push). */
export function PushToggle() {
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [estado, setEstado] = useState<Estado>("carregando");
  const [msg, setMsg] = useState("");
  const [p, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!chave) return setEstado("sem-chave");
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setEstado(ios && !instalado ? "ios-instalar" : "sem-suporte");
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "ligado" : "desligado");
    })().catch(() => setEstado("sem-suporte"));
  }, [chave]);

  const ligar = () => start(async () => {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm === "denied" ? "bloqueado" : "desligado"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(chave!) });
      const r = await salvarInscricaoPush(sub.toJSON(), nomeAparelho());
      if (r.erro) { setMsg(r.erro); return; }
      setEstado("ligado");
      setMsg("Pronto! Toque em “Testar” para ver como chega.");
    } catch {
      setMsg("Não deu para ativar neste navegador. Tente pelo Chrome ou com o app instalado.");
    }
  });

  const desligar = () => start(async () => {
    setMsg("");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removerInscricaoPush(sub.endpoint); await sub.unsubscribe().catch(() => {}); }
    setEstado("desligado");
  });

  const testar = () => start(async () => {
    const r = await testarPush();
    setMsg(r.erro ?? "Enviado. Deve aparecer em alguns segundos.");
  });

  if (estado === "carregando" || estado === "sem-chave") return null;

  const textos: Record<Exclude<Estado, "carregando" | "sem-chave">, string> = {
    "ligado": "Este aparelho recebe um aviso a cada pedido novo, mesmo com o site fechado.",
    "desligado": "Receba um aviso neste celular a cada pedido novo, mesmo com o site fechado.",
    "bloqueado": "As notificações deste site estão bloqueadas. Libere nas configurações do navegador e recarregue a página.",
    "ios-instalar": "No iPhone, primeiro instale o app: toque em Compartilhar → “Adicionar à Tela de Início”, abra por lá e ative aqui.",
    "sem-suporte": "Este navegador não recebe notificações. Use o Chrome no Android ou no computador.",
  };

  return (
    <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pine-50 text-xl" aria-hidden>🔔</span>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">Aviso de pedido novo {estado === "ligado" && <span className="badge ml-1 bg-green-100 text-green-800">ativo</span>}</div>
        <p className="text-sm text-ink-2">{textos[estado]}</p>
        {msg && <p className="mt-1 text-sm font-semibold text-pine-700" role="status">{msg}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {estado === "desligado" && <button className="btn-primary" disabled={p} onClick={ligar}>{p ? "Ativando…" : "Ativar neste celular"}</button>}
        {estado === "ligado" && (
          <>
            <button className="btn-outline" disabled={p} onClick={testar}>Testar</button>
            <button className="btn-ghost" disabled={p} onClick={desligar}>Desativar</button>
          </>
        )}
      </div>
    </div>
  );
}

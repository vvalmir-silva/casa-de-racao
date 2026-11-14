import * as webpush from "web-push";
import { sql } from "./db";

/**
 * Notificação push (Web Push) para quem ativou no painel.
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e, opcional, VAPID_SUBJECT (mailto:…).
 */
export function pushConfigurado() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let pronto = false;
function configurar() {
  if (pronto || !pushConfigurado()) return pronto;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@casaderacao.local", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  pronto = true;
  return pronto;
}

type Msg = { titulo: string; corpo: string; url?: string; tag?: string };

/** Envia para os aparelhos inscritos de usuários com os papéis dados. Nunca lança. Remove inscrições expiradas. */
export async function enviarPush(msg: Msg, papeis: string[] = ["admin"]) {
  if (!configurar()) return { enviados: 0, desativado: true };
  const subs = (await sql`
    SELECT s.id, s.endpoint, s.p256dh, s.auth FROM push_inscricoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE u.ativo AND u.papel = ANY(${papeis})
  `.catch(() => [])) as { id: number; endpoint: string; p256dh: string; auth: string }[];
  let enviados = 0;
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 6, urgency: "high" });
      enviados++;
      await sql`UPDATE push_inscricoes SET ultimo_envio = now() WHERE id = ${s.id}`;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`DELETE FROM push_inscricoes WHERE id = ${s.id}`;
    }
  }));
  return { enviados };
}

/** Divide um arquivo .sql em comandos (respeita blocos $$ … $$). */
export function splitStatements(text: string) {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  const src = text.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    buf += ch;
    if (ch === "$" && src[i + 1] === "$") { inDollar = !inDollar; buf += "$"; i++; continue; }
    if (ch === ";" && !inDollar) { if (buf.trim()) out.push(buf.trim()); buf = ""; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

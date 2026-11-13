import { exigirSessao } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigirSessao(["admin"]);
  return (
    <div className="md:-mx-4 md:grid md:grid-cols-[220px_1fr] md:gap-0">
      <AdminNav />
      <div className="min-w-0 md:px-8 md:py-2">{children}</div>
    </div>
  );
}

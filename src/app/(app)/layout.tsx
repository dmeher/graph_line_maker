import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { createOfflineSessionTicket } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const offlineSessionTicket = createOfflineSessionTicket(session);

  return <AppShell session={session} offlineSessionTicket={offlineSessionTicket}>{children}</AppShell>;
}

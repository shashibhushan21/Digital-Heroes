import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/session";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdmin();
  return <>{children}</>;
}

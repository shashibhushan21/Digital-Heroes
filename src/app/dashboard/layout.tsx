import type { ReactNode } from "react";
import { requireActiveSubscription } from "@/lib/auth/session";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  await requireActiveSubscription();
  return <>{children}</>;
}

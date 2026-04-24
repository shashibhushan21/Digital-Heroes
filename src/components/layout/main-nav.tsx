import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/layout/logout-button";

export async function MainNav() {
  const user = await getCurrentUser();
  const role = user ? (user.app_metadata?.role ?? user.user_metadata?.role) : null;
  const isAdmin = role === "admin";

  const links = [
    { href: "/", label: "Home" },
    { href: "/charities", label: "Charities" },
    ...(user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/70 backdrop-blur-xl supports-backdrop-filter:bg-white/60">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 shadow-sm hover:border-slate-300 hover:bg-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white shadow-[0_10px_25px_-10px_rgba(16,32,58,0.6)]">
            DH
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-slate-950">Digital Heroes</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Charity-led golf</span>
          </span>
        </Link>
        <ul className="flex items-center gap-2 text-sm font-medium text-slate-600 sm:gap-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link className="rounded-full px-3 py-2 transition hover:bg-slate-900/5 hover:text-slate-950" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
          {!user ? (
            <li>
              <Link className="rounded-full border border-slate-300 bg-slate-950 px-4 py-2 text-white shadow-sm transition hover:bg-slate-800" href="/auth/login">
                Sign in
              </Link>
            </li>
          ) : (
            <li>
              <LogoutButton />
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

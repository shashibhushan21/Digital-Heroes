"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AnimatedCard } from "@/components/ui/animated-surface";

const emailSchema = z.object({
  email: z.email("Enter a valid email address."),
});

type EmailFormValues = z.infer<typeof emailSchema>;

type AccountResponse = {
  user: {
    id: string;
    email: string | null;
  };
  error?: string;
};

async function getAccount() {
  const response = await fetch("/api/user/account");
  const payload = (await response.json()) as AccountResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch account details.");
  }

  return payload.user;
}

export function AccountSettingsCard() {
  const accountQuery = useQuery({ queryKey: ["account-settings"], queryFn: getAccount });
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (accountQuery.data?.email) {
      form.setValue("email", accountQuery.data.email);
    }
  }, [accountQuery.data?.email, form]);

  const updateEmailMutation = useMutation({
    mutationFn: async (values: EmailFormValues) => {
      const response = await fetch("/api/user/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update email.");
      }

      return payload.message ?? "Account updated.";
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sign out.");
      }
    },
    onSuccess: () => {
      window.location.href = "/auth/login";
    },
  });

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Profile</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Account Settings</h2>
      <p className="mt-1 text-sm text-slate-600">Update your sign-in email for account communication.</p>

      {accountQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading account...</p> : null}
      {accountQuery.error ? <p className="mt-3 text-sm text-red-600">{(accountQuery.error as Error).message}</p> : null}

      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={form.handleSubmit((values) => updateEmailMutation.mutate(values))}
      >
        <input
          type="email"
          placeholder="you@example.com"
          className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
          {...form.register("email")}
        />

        <button
          type="submit"
          disabled={updateEmailMutation.isPending}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(16,32,58,0.75)] hover:bg-slate-800 disabled:opacity-70"
        >
          {updateEmailMutation.isPending ? "Saving..." : "Update Email"}
        </button>
      </form>

      {form.formState.errors.email ? <p className="mt-2 text-sm text-red-600">{form.formState.errors.email.message}</p> : null}
      {updateEmailMutation.error ? (
        <p className="mt-3 text-sm text-red-600">{(updateEmailMutation.error as Error).message}</p>
      ) : null}
      {updateEmailMutation.isSuccess ? (
        <p className="mt-3 text-sm text-emerald-700">{updateEmailMutation.data}</p>
      ) : null}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-600">Need to switch accounts on this device?</p>
        <button
          type="button"
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
          className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 hover:text-slate-950 disabled:opacity-70"
        >
          {signOutMutation.isPending ? "Signing out..." : "Sign Out"}
        </button>
        {signOutMutation.error ? (
          <p className="mt-2 text-sm text-red-600">{(signOutMutation.error as Error).message}</p>
        ) : null}
      </div>
    </AnimatedCard>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedCard } from "@/components/ui/animated-surface";

type NotificationStatus = "queued" | "sent" | "failed" | "suppressed";

type NotificationRow = {
  id: string;
  event_type: string;
  delivery_status: NotificationStatus;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  users: { email: string } | null;
};

type AdminNotificationsResponse = {
  summary: Record<NotificationStatus, number>;
  notifications: NotificationRow[];
  error?: string;
};

async function getAdminNotifications(): Promise<AdminNotificationsResponse> {
  const response = await fetch("/api/admin/notifications");
  const payload = (await response.json()) as AdminNotificationsResponse;
  if (!response.ok) throw new Error(payload.error ?? "Unable to fetch notifications.");
  return payload;
}

function prettyDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function NotificationQueuePanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | "all">("all");

  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: getAdminNotifications,
    refetchInterval: 20_000,
  });

  const retryMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/admin/notifications/${notificationId}/retry`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to retry notification.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const dispatchNowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/notifications/dispatch", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to dispatch notifications.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const filteredNotifications = useMemo(() => {
    const rows = notificationsQuery.data?.notifications ?? [];
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.delivery_status === statusFilter);
  }, [notificationsQuery.data?.notifications, statusFilter]);

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notifications</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Notification Queue</h2>
      <p className="mt-1 text-sm text-slate-600">Monitor queued/sent/failed notifications and retry failed deliveries.</p>

      {notificationsQuery.isLoading ? <p className="mt-3 text-sm text-slate-600">Loading notifications...</p> : null}
      {notificationsQuery.error ? (
        <p className="mt-3 text-sm text-red-600">{(notificationsQuery.error as Error).message}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => dispatchNowMutation.mutate()}
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          {dispatchNowMutation.isPending ? "Dispatching..." : "Dispatch Now"}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("queued")}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
        >
          Queued ({notificationsQuery.data?.summary.queued ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("sent")}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
        >
          Sent ({notificationsQuery.data?.summary.sent ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("failed")}
          className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 shadow-sm hover:border-red-400 hover:bg-red-50"
        >
          Failed ({notificationsQuery.data?.summary.failed ?? 0})
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {dispatchNowMutation.error ? (
          <p className="text-sm text-red-600">{(dispatchNowMutation.error as Error).message}</p>
        ) : null}

        {filteredNotifications.map((row) => (
          <article key={row.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{row.users?.email ?? "Unknown recipient"}</p>
              <p className="text-xs text-slate-600">{row.delivery_status}</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Event: {row.event_type}</p>
            <p className="mt-1 text-xs text-slate-600">Created: {prettyDate(row.created_at)}</p>
            <p className="mt-1 text-xs text-slate-600">Sent: {prettyDate(row.sent_at)}</p>
            {row.error_message ? <p className="mt-1 text-xs text-red-600">Error: {row.error_message}</p> : null}

            {row.delivery_status !== "sent" ? (
              <button
                type="button"
                onClick={() => retryMutation.mutate(row.id)}
                className="mt-3 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:text-slate-950"
              >
                Retry
              </button>
            ) : null}
          </article>
        ))}

        {!filteredNotifications.length ? <p className="text-sm text-slate-600">No notifications in this view.</p> : null}
      </div>
    </AnimatedCard>
  );
}

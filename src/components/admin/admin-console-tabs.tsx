"use client";

import { useMemo, useState } from "react";
import { AdminAnalyticsPanel } from "@/components/admin/admin-analytics-panel";
import { CharityManagementPanel } from "@/components/admin/charity-management-panel";
import { DrawControlPanel } from "@/components/admin/draw-control-panel";
import { NotificationQueuePanel } from "@/components/admin/notification-queue-panel";
import { ScoreModerationPanel } from "@/components/admin/score-moderation-panel";
import { SubscriptionManagementPanel } from "@/components/admin/subscription-management-panel";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { WinnerManagementPanel } from "@/components/admin/winner-management-panel";

type AdminTabId =
  | "analytics"
  | "users"
  | "subscriptions"
  | "scores"
  | "charities"
  | "draws"
  | "winners"
  | "notifications";

const tabs: Array<{ id: AdminTabId; label: string }> = [
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "scores", label: "Scores" },
  { id: "charities", label: "Charities" },
  { id: "draws", label: "Draws" },
  { id: "winners", label: "Winners" },
  { id: "notifications", label: "Notifications" },
];

export function AdminConsoleTabs() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("analytics");

  const activePanel = useMemo(() => {
    switch (activeTab) {
      case "analytics":
        return <AdminAnalyticsPanel />;
      case "users":
        return <UserManagementPanel />;
      case "subscriptions":
        return <SubscriptionManagementPanel />;
      case "scores":
        return <ScoreModerationPanel />;
      case "charities":
        return <CharityManagementPanel />;
      case "draws":
        return <DrawControlPanel />;
      case "winners":
        return <WinnerManagementPanel />;
      case "notifications":
        return <NotificationQueuePanel />;
      default:
        return <AdminAnalyticsPanel />;
    }
  }, [activeTab]);

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div
          role="tablist"
          aria-label="Admin sections"
          className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-sm"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`admin-tab-panel-${tab.id}`}
                id={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.8)]"
                    : "bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`admin-tab-panel-${activeTab}`}
        aria-labelledby={`admin-tab-${activeTab}`}
      >
        {activePanel}
      </div>
    </section>
  );
}
import { AuthGate } from "@/components/auth/AuthContext";
import { BotProvider } from "@/components/dashboard/BotContext";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SubscriptionProvider } from "@/components/dashboard/SubscriptionContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <BotProvider>
        <SubscriptionProvider>
          <DashboardShell>{children}</DashboardShell>
        </SubscriptionProvider>
      </BotProvider>
    </AuthGate>
  );
}

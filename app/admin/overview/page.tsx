import { OverviewView } from "@/components/admin/overview/OverviewView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminOverviewPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Overview</h1>
      <p className={shellStyles.mainLead}>
        Snapshot of registered users, active subscriptions, revenue estimates from
        list prices, and aggregate ad sends recorded in daily buckets.
      </p>
      <OverviewView />
    </>
  );
}

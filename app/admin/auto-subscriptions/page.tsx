import { AutoSubscriptionsView } from "@/components/admin/autoSubscriptions/AutoSubscriptionsView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminAutoSubscriptionsPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Auto subscriptions</h1>
      <p className={shellStyles.mainLead}>
        Grant Pro or Business for a set number of days when a matching user
        signs up or connects Discord. Each account receives at most one
        automatic grant (tracked on the user record).
      </p>
      <AutoSubscriptionsView />
    </>
  );
}

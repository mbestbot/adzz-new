import { PotentialClientsView } from "@/components/admin/potentialClients/PotentialClientsView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminPotentialClientsPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Potential clients</h1>
      <p className={shellStyles.mainLead}>
        One small card per Discord server (deduped). Reload the page to refresh
        names, icons, member counts, and join links from the latest cache.
      </p>
      <PotentialClientsView />
    </>
  );
}

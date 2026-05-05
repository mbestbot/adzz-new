import { PotentialClientsView } from "@/components/admin/potentialClients/PotentialClientsView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminPotentialClientsPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Potential clients</h1>
      <p className={shellStyles.mainLead}>
        One small card per Discord server (deduped). The list refreshes on a
        timer and when you return to this tab; use search to filter cards.
      </p>
      <PotentialClientsView />
    </>
  );
}

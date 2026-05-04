import { PotentialClientsView } from "@/components/admin/potentialClients/PotentialClientsView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminPotentialClientsPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Potential clients</h1>
      <p className={shellStyles.mainLead}>
        Every unique Discord server seen across cached bot guild lists (deduped by
        server ID). Channel names and the &quot;Open&quot; link are rebuilt from the
        latest cache whenever you load this page, so they stay in sync after users
        refresh from Discord.
      </p>
      <PotentialClientsView />
    </>
  );
}

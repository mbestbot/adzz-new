import { BotsView } from "@/components/admin/bots/BotsView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminBotsPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Bots</h1>
      <p className={shellStyles.mainLead}>
        All stored bots, which proxy host their Discord REST traffic is pinned to (when
        proxies are configured), and total ads sent across campaigns. The “i” panel
        includes credentials — admin routes are unauthenticated; do not expose publicly.
      </p>
      <BotsView />
    </>
  );
}

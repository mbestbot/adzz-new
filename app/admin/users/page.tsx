import { UsersView } from "@/components/admin/users/UsersView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminUsersPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Users</h1>
      <p className={shellStyles.mainLead}>
        All accounts in the local store with subscription tier resolved from active
        billing records.
      </p>
      <UsersView />
    </>
  );
}

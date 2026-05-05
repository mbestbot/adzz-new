import { UsersView } from "@/components/admin/users/UsersView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminUsersPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Users</h1>
      <p className={shellStyles.mainLead}>
        All accounts in the local store with subscription tier resolved from active
        billing records. Passwords are stored as secure hashes and{" "}
        <strong>cannot be viewed or recovered</strong>. To sign in as a user for
        support, open <strong>Manage</strong> → <strong>Set login password</strong>,
        choose a temporary password, then log in with their email (Discord-only
        accounts use the synthetic email shown in Manage).
      </p>
      <UsersView />
    </>
  );
}

import { UsersView } from "@/components/admin/users/UsersView";
import shellStyles from "@/components/admin/adminShell.module.css";

export default function AdminUsersPage() {
  return (
    <>
      <h1 className={shellStyles.mainTitle}>Users</h1>
      <p className={shellStyles.mainLead}>
        All accounts in the local store with subscription tier resolved from active
        billing records. Passwords are stored as secure hashes and{" "}
        <strong>cannot be viewed or recovered</strong>. Use{" "}
        <strong>Manage</strong> → <strong>Set login password</strong> to reset their
        main password (including forgotten email/password logins). Use{" "}
        <strong>One-time password</strong> for a single-use support login that leaves
        their normal password unchanged.
      </p>
      <UsersView />
    </>
  );
}

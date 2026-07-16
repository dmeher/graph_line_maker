import { CheckCircle2, Clock3, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { getAppUsers, getCurrentSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { updateAppUser, upsertAppUser } from "@/app/(app)/settings/actions";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/constants";
import type { AppUser } from "@/lib/types";

export const metadata = {
  title: "Settings",
};

function UserUpdateFields({ user }: { user: AppUser }) {
  if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
    return <span className="settings-locked-badge"><ShieldCheck size={13} /> Primary admin</span>;
  }

  return (
    <form action={updateAppUser} className="settings-user-actions">
      <input type="hidden" name="userId" value={user.id} />
      <label>
        <span className="sr-only">Role for {user.email}</span>
        <select name="role" defaultValue={user.role} className="ui-input">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Status for {user.email}</span>
        <select name="status" defaultValue={user.status} className="ui-input">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <button className="ui-btn">Save</button>
    </form>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  const userPage = session?.role === "admin" ? await getAppUsers(params.cursor) : { users: [], nextCursor: null };
  const { users, nextCursor } = userPage;
  const currentUser = users.find((user) => user.id === session?.userId) ?? null;

  return (
    <div className="settings-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">Account administration</p>
          <h1>Settings</h1>
          <p>Manage your session, access role, and approved workspace members.</p>
        </div>
        <span className="ui-status"><ShieldCheck size={14} /> Email OTP protected</span>
      </header>

      <section className="settings-account-card">
        <div className="settings-section-heading">
          <span className="settings-section-icon"><ShieldCheck size={18} /></span>
          <div>
            <h2>Signed-in account</h2>
            <p>Your current verified Graph Pixel Maker identity.</p>
          </div>
        </div>
        <div className="settings-account-grid">
          <div className="settings-account-profile">
            <span className="settings-account-avatar">{(session?.displayName || session?.email || "GP").slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{session?.displayName || session?.email?.split("@")[0] || "Signed-in user"}</strong>
              <span>{session?.email}</span>
              <small><CheckCircle2 size={12} /> Active session</small>
            </div>
          </div>
          <dl className="settings-account-facts">
            <div><dt>Role</dt><dd className="capitalize">{session?.role || "member"}</dd></div>
            <div><dt>Authentication</dt><dd>Email OTP</dd></div>
            <div><dt>Last sign in</dt><dd>{currentUser?.lastLoginAt ? formatDateTime(currentUser.lastLoginAt) : "Current session"}</dd></div>
            <div><dt>Access</dt><dd>{session?.role === "admin" ? "User management" : "Project workspace"}</dd></div>
          </dl>
        </div>
      </section>

      {session?.role === "admin" ? (
        <>
          <section className="settings-invite-card">
            <div className="settings-section-heading">
              <span className="settings-section-icon"><UserPlus size={18} /></span>
              <div>
                <h2>Add an approved user</h2>
                <p>Only active users in this list can request a sign-in code.</p>
              </div>
            </div>
            <form action={upsertAppUser} className="settings-invite-form">
              <label>Email address<input name="email" type="email" autoComplete="off" placeholder="user@example.com" className="ui-input" required /></label>
              <label>Display name<input name="displayName" placeholder="Optional name" className="ui-input" /></label>
              <label>Role<select name="role" className="ui-input"><option value="member">Member</option><option value="admin">Admin</option></select></label>
              <button className="ui-btn ui-btn-primary"><UserPlus size={15} /> Add user</button>
            </form>
          </section>

          <section className="settings-users-card">
            <div className="settings-users-header">
              <div className="settings-section-heading">
                <span className="settings-section-icon"><Users size={18} /></span>
                <div>
                  <h2>Approved users</h2>
                  <p>{users.length} users on this page · roles apply immediately.</p>
                </div>
              </div>
            </div>

            {users.length ? (
              <>
                <div className="settings-user-table-wrap">
                  <table className="ui-table settings-user-table">
                    <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign in</th><th>Added</th><th>Access controls</th></tr></thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.displayName || user.email.split("@")[0]}</strong><span>{user.email}</span></td>
                          <td className="capitalize">{user.role}</td>
                          <td><span className={"settings-status settings-status--" + user.status}>{user.status}</span></td>
                          <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</td>
                          <td>{formatDateTime(user.createdAt)}</td>
                          <td><UserUpdateFields user={user} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="settings-user-cards">
                  {users.map((user) => (
                    <article key={user.id} className="settings-user-card">
                      <header>
                        <span>{(user.displayName || user.email).slice(0, 2).toUpperCase()}</span>
                        <div><strong>{user.displayName || user.email.split("@")[0]}</strong><small>{user.email}</small></div>
                        <span className={"settings-status settings-status--" + user.status}>{user.status}</span>
                      </header>
                      <dl>
                        <div><dt>Role</dt><dd className="capitalize">{user.role}</dd></div>
                        <div><dt>Last sign in</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</dd></div>
                      </dl>
                      <UserUpdateFields user={user} />
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="settings-empty-users"><Mail size={22} /><strong>No users on this page</strong><span>Add an approved email above.</span></div>
            )}

            <footer className="page-pagination settings-pagination">
              <span><Clock3 size={13} /> 25 users per page</span>
              <div>
                {params.cursor ? <Link href="/settings" className="ui-btn">First page</Link> : null}
                {nextCursor ? <Link href={"/settings?cursor=" + encodeURIComponent(nextCursor)} className="ui-btn">Next page</Link> : null}
              </div>
            </footer>
          </section>
        </>
      ) : (
        <section className="settings-member-note">
          <ShieldCheck size={20} />
          <div><strong>Member access</strong><p>An administrator manages approved users and roles for this workspace.</p></div>
        </section>
      )}
    </div>
  );
}

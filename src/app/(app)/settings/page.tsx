import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
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
    return (
      <span className="settings-locked-badge access-user-controls__protected">
        <ShieldCheck size={13} aria-hidden="true" />
        Primary admin
      </span>
    );
  }

  return (
    <form
      action={updateAppUser}
      className="settings-user-actions access-user-controls"
      aria-label={`Update access for ${user.email}`}
    >
      <input type="hidden" name="userId" value={user.id} />
      <label className="access-user-controls__field">
        <span>Role</span>
        <select
          name="role"
          defaultValue={user.role}
          className="ui-input settings-control-select"
          aria-label={`Role for ${user.email}`}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="access-user-controls__field">
        <span>Status</span>
        <select
          name="status"
          defaultValue={user.status}
          className="ui-input settings-control-select"
          aria-label={`Status for ${user.email}`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <button type="submit" className="ui-btn access-user-controls__save">Save access</button>
    </form>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  const userPage = session?.role === "admin" ? await getAppUsers(params.cursor) : { users: [], nextCursor: null };
  const { users, nextCursor } = userPage;
  const currentUser = users.find((user) => user.id === session?.userId) ?? null;
  const initials = (session?.displayName || session?.email || "GP").slice(0, 2).toUpperCase();
  const displayName = session?.displayName || session?.email?.split("@")[0] || "Signed-in user";

  return (
    <div className="settings-page workspace-page atelier-page settings-workspace">
      <header className="settings-workspace__masthead">
        <div>
          <p className="page-eyebrow">
            <ShieldCheck size={13} aria-hidden="true" />
            Atelier / Settings
          </p>
          <h1>Workspace control room.</h1>
          <p>Identity, security, and studio access—organized without interrupting your creative work.</p>
        </div>
        <span className="settings-security-status settings-workspace__assurance">
          <LockKeyhole size={15} aria-hidden="true" />
          Passwordless protection
        </span>
      </header>

      <div className="settings-workspace__layout">
        <aside className="settings-index" aria-label="Settings sections">
          <div className="settings-index__heading">
            <span>Control room</span>
            <small>Workspace preferences</small>
          </div>
          <nav>
            <a href="#identity">
              <span aria-hidden="true">01</span>
              Identity
            </a>
            <a href="#security">
              <span aria-hidden="true">02</span>
              Security
            </a>
            <a href="#access">
              <span aria-hidden="true">03</span>
              Access
            </a>
          </nav>
          <div className="settings-index__signal">
            <span className="settings-index__signal-icon" aria-hidden="true">
              <BadgeCheck size={16} />
            </span>
            <span>
              <strong>Verified session</strong>
              <small>Protected by email OTP</small>
            </span>
          </div>
        </aside>

        <div className="settings-workspace__content">
          <section
            id="identity"
            className="settings-account-card settings-panel settings-surface settings-identity"
            aria-labelledby="settings-account-title"
          >
            <header className="settings-panel__header settings-section-head">
              <div className="settings-section-head__number" aria-hidden="true">01</div>
              <div className="settings-section-head__copy">
                <p className="settings-kicker">Verified identity</p>
                <h2 id="settings-account-title">Your studio profile</h2>
                <p>The identity attached to projects, permissions, and secure workspace access.</p>
              </div>
              <span className="settings-session-state">
                <i aria-hidden="true" />
                Active session
              </span>
            </header>

            <div className="settings-identity__profile">
              <div className="settings-account-profile settings-identity__person">
                <span className="settings-account-avatar settings-identity__avatar" aria-hidden="true">{initials}</span>
                <div>
                  <span className="settings-identity__label">Signed in as</span>
                  <strong>{displayName}</strong>
                  <span>{session?.email}</span>
                  <small><CheckCircle2 size={12} aria-hidden="true" /> Identity verified</small>
                </div>
              </div>

              <dl className="settings-account-facts settings-identity__facts">
                <div>
                  <dt>Workspace role</dt>
                  <dd className="capitalize">{session?.role || "member"}</dd>
                  <span>{session?.role === "admin" ? "Full control" : "Project access"}</span>
                </div>
                <div>
                  <dt>Authentication</dt>
                  <dd>Email OTP</dd>
                  <span>No password stored</span>
                </div>
                <div>
                  <dt>Last sign in</dt>
                  <dd>
                    {currentUser?.lastLoginAt ? (
                      <time dateTime={currentUser.lastLoginAt}>{formatDateTime(currentUser.lastLoginAt)}</time>
                    ) : "Current session"}
                  </dd>
                  <span>Verified request</span>
                </div>
              </dl>
            </div>
          </section>

          <section
            id="security"
            className="settings-panel settings-surface settings-security"
            aria-labelledby="settings-security-title"
          >
            <header className="settings-panel__header settings-section-head">
              <div className="settings-section-head__number" aria-hidden="true">02</div>
              <div className="settings-section-head__copy">
                <p className="settings-kicker">Security posture</p>
                <h2 id="settings-security-title">Access stays intentionally narrow</h2>
                <p>Your account uses short-lived codes and an approved-user directory.</p>
              </div>
            </header>

            <div className="settings-security__grid">
              <article>
                <span aria-hidden="true"><KeyRound size={18} /></span>
                <div>
                  <small>Sign-in method</small>
                  <strong>One-time email code</strong>
                  <p>Each request uses a new six-digit code with a limited lifetime.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true"><Fingerprint size={18} /></span>
                <div>
                  <small>Current session</small>
                  <strong>Identity verified</strong>
                  <p>Your signed session is linked to the approved workspace identity above.</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true"><ShieldCheck size={18} /></span>
                <div>
                  <small>Workspace gate</small>
                  <strong>Allowlist protected</strong>
                  <p>Only active addresses in the directory can complete sign-in.</p>
                </div>
              </article>
            </div>
          </section>

          {session?.role === "admin" ? (
            <section
              id="access"
              className="settings-users-card settings-panel settings-surface settings-access"
              aria-labelledby="settings-access-title"
            >
              <header className="settings-panel__header settings-section-head settings-access__head">
                <div className="settings-section-head__number" aria-hidden="true">03</div>
                <div className="settings-section-head__copy">
                  <p className="settings-kicker">Studio access</p>
                  <h2 id="settings-access-title">Approved people</h2>
                  <p>Invite collaborators, assign roles, and pause access without removing project data.</p>
                </div>
                <span className="settings-users-count">
                  <strong>{users.length}</strong>
                  on this page
                </span>
              </header>

              <div className="settings-invite-card settings-access__invite" aria-labelledby="settings-invite-title">
                <div className="settings-access__invite-copy">
                  <span className="settings-section-icon" aria-hidden="true"><UserPlus size={18} /></span>
                  <div>
                    <p className="settings-kicker">Add collaborator</p>
                    <h3 id="settings-invite-title">Approve an email address</h3>
                    <p>They can request a sign-in code as soon as this record is active.</p>
                  </div>
                </div>

                <form action={upsertAppUser} className="settings-invite-form settings-access__invite-form">
                  <label className="settings-field">
                    <span>Email address</span>
                    <span className="settings-field__control">
                      <AtSign size={16} aria-hidden="true" />
                      <input
                        name="email"
                        type="email"
                        autoComplete="off"
                        placeholder="name@studio.com"
                        className="ui-input"
                        required
                      />
                    </span>
                  </label>
                  <label className="settings-field">
                    <span>Display name</span>
                    <span className="settings-field__control">
                      <Users size={16} aria-hidden="true" />
                      <input name="displayName" placeholder="Optional name" className="ui-input" />
                    </span>
                  </label>
                  <label className="settings-field">
                    <span>Workspace role</span>
                    <span className="settings-field__control settings-field__control--select">
                      <ShieldCheck size={16} aria-hidden="true" />
                      <select name="role" className="ui-input">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </span>
                  </label>
                  <button type="submit" className="ui-btn ui-btn-primary settings-access__invite-button">
                    <UserPlus size={15} aria-hidden="true" />
                    Add to workspace
                  </button>
                </form>
              </div>

              <div className="settings-access__directory" aria-labelledby="settings-users-title">
                <header className="settings-users-header settings-access__directory-head">
                  <div>
                    <p className="settings-kicker">Access directory</p>
                    <h3 id="settings-users-title">Workspace members</h3>
                  </div>
                  <span>Changes apply to the next verified request.</span>
                </header>

                {users.length ? (
                  <>
                    <div className="settings-user-table-wrap settings-access__table-wrap">
                      <table className="ui-table settings-user-table settings-access__table">
                        <caption className="sr-only">Approved Graph Pixel Maker users</caption>
                        <thead>
                          <tr>
                            <th scope="col">Person</th>
                            <th scope="col">Access</th>
                            <th scope="col">Last sign in</th>
                            <th scope="col">Added</th>
                            <th scope="col">Controls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id}>
                              <td>
                                <span className="settings-access__user">
                                  <span aria-hidden="true">{(user.displayName || user.email).slice(0, 2).toUpperCase()}</span>
                                  <span>
                                    <strong>{user.displayName || user.email.split("@")[0]}</strong>
                                    <small>{user.email}</small>
                                  </span>
                                </span>
                              </td>
                              <td>
                                <span className="settings-access__access">
                                  <span className={"settings-status settings-status--" + user.status}>
                                    <i aria-hidden="true" />
                                    {user.status}
                                  </span>
                                  <small className="capitalize">{user.role}</small>
                                </span>
                              </td>
                              <td>
                                {user.lastLoginAt ? (
                                  <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
                                ) : "Never"}
                              </td>
                              <td><time dateTime={user.createdAt}>{formatDateTime(user.createdAt)}</time></td>
                              <td><UserUpdateFields user={user} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="settings-user-cards settings-access__cards">
                      {users.map((user) => (
                        <article key={user.id} className="settings-user-card settings-access__card">
                          <header>
                            <span className="settings-access__card-avatar" aria-hidden="true">
                              {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <strong>{user.displayName || user.email.split("@")[0]}</strong>
                              <small>{user.email}</small>
                            </div>
                            <span className={"settings-status settings-status--" + user.status}>
                              <i aria-hidden="true" />
                              {user.status}
                            </span>
                          </header>
                          <dl>
                            <div>
                              <dt>Role</dt>
                              <dd className="capitalize">{user.role}</dd>
                            </div>
                            <div>
                              <dt>Last sign in</dt>
                              <dd>
                                {user.lastLoginAt ? (
                                  <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
                                ) : "Never"}
                              </dd>
                            </div>
                            <div>
                              <dt>Added</dt>
                              <dd><time dateTime={user.createdAt}>{formatDateTime(user.createdAt)}</time></dd>
                            </div>
                          </dl>
                          <UserUpdateFields user={user} />
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="settings-empty-users settings-access__empty">
                    <span aria-hidden="true"><Mail size={22} /></span>
                    <strong>No users on this page</strong>
                    <span>Add an approved email above to grow the workspace.</span>
                  </div>
                )}
              </div>

              <footer className="page-pagination settings-pagination settings-access__pagination" aria-label="User pages">
                <span><Clock3 size={13} aria-hidden="true" /> 25 users per page</span>
                <div>
                  {params.cursor ? <Link href="/settings" className="ui-btn">First page</Link> : null}
                  {nextCursor ? (
                    <Link href={"/settings?cursor=" + encodeURIComponent(nextCursor)} className="ui-btn">
                      Next page
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </footer>
            </section>
          ) : (
            <section
              id="access"
              className="settings-member-note settings-panel settings-surface settings-member-access"
              aria-labelledby="member-access-title"
            >
              <div className="settings-section-head__number" aria-hidden="true">03</div>
              <span className="settings-section-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
              <div>
                <p className="settings-kicker">Studio access</p>
                <h2 id="member-access-title">Member workspace</h2>
                <p>An administrator manages approved users and roles. Your complete project toolkit remains available.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

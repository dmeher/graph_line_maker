import { getAppUsers, getCurrentSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { updateAppUser, upsertAppUser } from "@/app/(app)/settings/actions";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/constants";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const users = session?.role === "admin" ? await getAppUsers() : [];

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">
      <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Signed in</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-950">{session?.email}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Role</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-950">{session?.role}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Auth</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">Brevo email OTP</p>
          </div>
        </div>
      </section>

      {session?.role === "admin" ? (
        <>
          <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-slate-950">Allowed users</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add active email addresses. Users sign in with the same Brevo OTP flow.
            </p>
            <form action={upsertAppUser} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
              <input
                name="email"
                type="email"
                placeholder="user@example.com"
                className="h-11 min-w-0 rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
                required
              />
              <input
                name="displayName"
                placeholder="Display name"
                className="h-11 min-w-0 rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              />
              <select name="role" className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button className="h-11 rounded-md bg-[var(--teal)] px-5 text-sm font-semibold text-white">
                Add user
              </button>
            </form>
          </section>

          <section className="rounded-md border border-[var(--line)] bg-white shadow-sm">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">{users.length} users</h2>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {["Email", "Name", "Role", "Status", "Last login", "Actions"].map((head) => (
                      <th key={head} className="border-b border-[var(--line)] px-4 py-3">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="border-b border-[var(--line)] px-4 py-3 font-mono text-xs">{user.email}</td>
                      <td className="border-b border-[var(--line)] px-4 py-3">{user.displayName || "-"}</td>
                      <td className="border-b border-[var(--line)] px-4 py-3 capitalize">{user.role}</td>
                      <td className="border-b border-[var(--line)] px-4 py-3 capitalize">{user.status}</td>
                      <td className="border-b border-[var(--line)] px-4 py-3">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="border-b border-[var(--line)] px-4 py-3">
                        {user.email === BOOTSTRAP_ADMIN_EMAIL ? (
                          <span className="text-xs font-semibold text-slate-500">Locked</span>
                        ) : (
                          <form action={updateAppUser} className="flex gap-2">
                            <input type="hidden" name="userId" value={user.id} />
                            <select name="role" defaultValue={user.role} className="h-9 rounded-md border border-[var(--line)] bg-white px-2 text-sm">
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <select name="status" defaultValue={user.status} className="h-9 rounded-md border border-[var(--line)] bg-white px-2 text-sm">
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                            <button className="h-9 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-slate-700">
                              Save
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--line)] lg:hidden">
              {users.map((user) => (
                <article key={user.id} className="space-y-3 p-4">
                  <div>
                    <p className="break-all font-mono text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 font-semibold text-slate-950">{user.displayName || user.email}</p>
                    <p className="mt-1 text-sm capitalize text-slate-600">
                      {user.role} - {user.status}
                    </p>
                  </div>
                  {user.email !== BOOTSTRAP_ADMIN_EMAIL ? (
                    <form action={updateAppUser} className="grid grid-cols-3 gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="role" defaultValue={user.role} className="h-10 rounded-md border border-[var(--line)] bg-white px-2 text-sm">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select name="status" defaultValue={user.status} className="h-10 rounded-md border border-[var(--line)] bg-white px-2 text-sm">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <button className="h-10 rounded-md border border-[var(--line)] text-sm font-semibold text-slate-700">
                        Save
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}


import { Edit3, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { getAppUsers, getCurrentSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { updateAppUser, upsertAppUser } from "@/app/(app)/settings/actions";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/constants";

export const metadata = {
  title: "Settings",
};

const sampleUsers = [
  ["Alex Kumar", "alex.kumar@example.com", "Admin", "Active", "Apr 20, 2025"],
  ["Priya Sharma", "priya.sharma@example.com", "Editor", "Active", "Apr 21, 2025"],
  ["Rohan Mehta", "rohan.mehta@example.com", "Viewer", "Active", "Apr 22, 2025"],
  ["Neha Verma", "neha.verma@example.com", "Editor", "Inactive", "May 2, 2025"],
  ["Arjun Nair", "arjun.nair@example.com", "Viewer", "Active", "May 3, 2025"],
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  const userPage = session?.role === "admin" ? await getAppUsers(params.cursor) : { users: [], nextCursor: null };
  const { users, nextCursor } = userPage;
  const showingSamples = !params.cursor && users.length === 0;

  return (
    <div className="mock-card min-h-[calc(100dvh-96px)] overflow-hidden p-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[#101828]">Settings</h1>

      <div className="mt-4 flex gap-7 border-b border-[#d7dde5] text-sm font-medium text-[#475467]">
        {["Account", "Auth & Roles", "Preferences"].map((tab, index) => (
          <button key={tab} className={`border-b-2 px-1 pb-2 ${index === 0 ? "border-[#008c8f] text-[#008c8f]" : "border-transparent"}`}>
            {tab}
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-md border border-[#d7dde5] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#101828]">Signed-in user</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#008c8f] text-sm font-semibold text-white">
              {(session?.displayName || session?.email || "AK").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#101828]">{session?.displayName || "Alex Kumar"}</p>
              <p className="truncate text-xs text-[#667085]">{session?.email || "alex.kumar@example.com"}</p>
              <span className="mt-2 inline-flex rounded bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#15803d]">Active</span>
            </div>
          </div>
          <div className="border-l border-[#e8edf2] pl-5 text-xs text-[#667085]">
            <p>Role</p>
            <p className="mt-1 font-semibold capitalize text-[#101828]">{session?.role || "Admin"}</p>
            <p className="mt-4">MFA (Email OTP)</p>
            <p className="font-semibold text-[#101828]">Enabled</p>
          </div>
          <div className="border-l border-[#e8edf2] pl-5 text-xs text-[#667085]">
            <p>Last sign in</p>
            <p className="mt-1 font-semibold text-[#101828]">May 12, 2025 10:48 AM</p>
            <p className="mt-4">Auth provider</p>
            <p className="font-semibold text-[#101828]">Email</p>
          </div>
          <div className="border-l border-[#e8edf2] pl-5 text-xs text-[#667085]">
            <p>Status</p>
            <p className="mt-1 font-semibold text-[#15803d]">Active</p>
            <p className="mt-4">Session expires</p>
            <p className="font-semibold text-[#101828]">May 12, 2025 12:48 PM</p>
          </div>
        </div>
      </section>

      {session?.role === "admin" ? (
        <section className="mt-5 overflow-hidden rounded-md border border-[#d7dde5] bg-white">
          <div className="flex items-center justify-between border-b border-[#d7dde5] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#101828]">Allowed users</h2>
            <form action={upsertAppUser} className="flex gap-2">
              <input name="email" type="email" placeholder="user@example.com" className="mock-input h-9 w-56" required />
              <input name="displayName" placeholder="Display name" className="mock-input h-9 w-44" />
              <select name="role" className="mock-input h-9 w-28">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button className="mock-btn mock-btn-primary h-9">
                Add user
                <UserPlus size={15} />
              </button>
            </form>
          </div>

          <div className="overflow-x-auto px-5 pb-3">
            <table className="mock-table min-w-[860px]">
              <thead>
                <tr>
                  {["Name", "Email", "Role", "Status", "Added on", "Actions"].map((head) => (
                    <th key={head}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-semibold text-[#101828]">{user.displayName || user.email}</td>
                    <td>{user.email}</td>
                    <td className="capitalize">{user.role}</td>
                    <td><span className={`inline-flex items-center gap-1 text-xs font-medium ${user.status === "active" ? "text-[#15803d]" : "text-[#b45309]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{user.status}</span></td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td>
                      {user.email === BOOTSTRAP_ADMIN_EMAIL ? (
                        <span className="text-xs font-semibold text-[#667085]">Locked</span>
                      ) : (
                        <form action={updateAppUser} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="role" defaultValue={user.role} className="mock-input h-8 w-28 px-2">
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <select name="status" defaultValue={user.status} className="mock-input h-8 w-28 px-2">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <button className="grid h-8 w-8 place-items-center rounded-md text-[#475467] hover:bg-[#f2f4f7]" title="Save">
                            <Edit3 size={15} />
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {showingSamples
                  ? sampleUsers.map(([name, email, role, status, added]) => (
                      <tr key={email}>
                        <td className="font-semibold text-[#101828]">{name}</td>
                        <td>{email}</td>
                        <td>{role}</td>
                        <td><span className={`inline-flex items-center gap-1 text-xs font-medium ${status === "Active" ? "text-[#15803d]" : "text-[#b45309]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span></td>
                        <td>{added}</td>
                        <td>
                          <div className="flex gap-2">
                            <button className="grid h-8 w-8 place-items-center rounded-md text-[#475467] hover:bg-[#f2f4f7]"><Edit3 size={15} /></button>
                            <button className="grid h-8 w-8 place-items-center rounded-md text-[#ef4444] hover:bg-red-50"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#e8edf2] px-5 py-3 text-xs text-[#667085]">
            <span>Showing up to {showingSamples ? sampleUsers.length : users.length} users on this page</span>
            <div className="flex gap-2">
              {params.cursor ? <Link href="/settings" className="mock-btn h-8 px-3 text-xs">First page</Link> : null}
              {nextCursor ? <Link href={`/settings?cursor=${encodeURIComponent(nextCursor)}`} className="mock-btn h-8 px-3 text-xs">Next</Link> : null}
              <span className="mock-btn h-8 px-3 text-xs">25 / page</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

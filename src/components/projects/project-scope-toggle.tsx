import Link from "next/link";
import { Users, UserRound } from "lucide-react";
import type { ProjectScope } from "@/lib/types";

/**
 * Admin-only dashboard scope switch. Server-rendered links rather than client
 * state: the scope is part of the query the page already reads, and switching it
 * has to reset the cursor anyway.
 */
export function ProjectScopeToggle({ scope, query }: { scope: ProjectScope; query: string }) {
  function hrefForScope(target: ProjectScope) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    // `all` is the admin default, so only `mine` needs to be pinned in the URL.
    if (target === "mine") params.set("scope", "mine");
    const search = params.toString();
    return search ? `/dashboard?${search}` : "/dashboard";
  }

  return (
    <div className="project-scope-toggle" role="group" aria-label="Project scope">
      {/* Labels are hidden on narrow viewports, so the accessible name and the
          tooltip both come from the attributes rather than the text. */}
      <Link
        href={hrefForScope("all")}
        className={scope === "all" ? "is-active" : ""}
        aria-current={scope === "all" ? "true" : undefined}
        aria-label="Show all workspace projects"
        title="All projects"
      >
        <Users size={14} aria-hidden="true" />
        <span>All projects</span>
      </Link>
      <Link
        href={hrefForScope("mine")}
        className={scope === "mine" ? "is-active" : ""}
        aria-current={scope === "mine" ? "true" : undefined}
        aria-label="Show only my projects"
        title="My projects"
      >
        <UserRound size={14} aria-hidden="true" />
        <span>Mine</span>
      </Link>
    </div>
  );
}

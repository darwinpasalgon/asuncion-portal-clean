"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  LogOut,
  Search,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import ProfileAvatar from "@/components/profile-avatar";
import {
  activePortalFeature,
  portalNavigation,
  searchPortalFeatures,
  type PortalFeatureGroup,
  type PortalRole,
} from "@/lib/portal-navigation";
import FeatureIcon from "./feature-icon";
import styles from "./portal-shell.module.css";

type Session = {
  profile: {
    id: string;
    full_name: string;
    email: string;
    lrn: string | null;
    grade_level: number | null;
    section: string | null;
    role: PortalRole;
    requested_role: "student" | "teacher" | "administrator";
    admin_role:
      | "super_administrator"
      | "registrar"
      | "content_administrator"
      | "school_administrator"
      | null;
    position: string | null;
    account_status: "active";
    must_change_password: boolean;
    has_profile_photo?: boolean;
    profile_photo_updated_at?: string | null;
  };
  academicContext: {
    school_year: string | null;
    school_year_id: string | null;
    grade_level: number | null;
    section: string | null;
    enrollment_status: string | null;
    tve_major: string | null;
    shs_track: string | null;
    shs_strand_program: string | null;
    sex: string | null;
  } | null;
  adminPermissions: string[];
  gradeLevelHead: { grade_level: number; display_name: string } | null;
  isAdviser: boolean;
};

type PortalContextValue = {
  session: Session;
  groups: PortalFeatureGroup[];
  communityUnread: number;
};
const PortalContext = createContext<PortalContextValue | null>(null);
export function usePortal() {
  const value = useContext(PortalContext);
  if (!value)
    throw new Error("Portal components require the portal workspace.");
  return value;
}

export function PortalLoading() {
  return (
    <div className={styles.loading} role="status">
      <img src="/school-logo.png" alt="" width={64} height={64} />
      <strong>Opening Your Workspace</strong>
      <span className={styles.loadingTrack}>
        <span />
      </span>
      <p>Getting your school tools ready…</p>
    </div>
  );
}

function roleName(session: Session) {
  const { profile, gradeLevelHead, adminPermissions } = session;
  if (gradeLevelHead) return `Grade ${gradeLevelHead.grade_level} Level Head`;
  if (profile.role === "student") return "Student";
  if (profile.role === "teacher")
    return session.isAdviser ? "Teacher · Class Adviser" : "Teacher";
  if (profile.role === "administrator") return "Super Administrator";
  if (profile.admin_role === "registrar") return "Registrar";
  if (profile.admin_role === "content_administrator")
    return "Content Administrator";
  if (adminPermissions.length === 1 && adminPermissions.includes("hr.manage"))
    return "Human Resources";
  return "School Administrator";
}

export default function PortalShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [hasPersonnelProfile, setHasPersonnelProfile] = useState(false);
  const [communityUnread, setCommunityUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setError("");
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.profile) {
          if (response.status === 401) {
            window.location.assign("/?reason=signin");
            return;
          }
          throw new Error(data.error ?? "Unable to open your workspace.");
        }
        if (!active) return;
        if (data.profile.must_change_password) {
          window.location.assign("/change-password");
          return;
        }
        setSession({
          ...data,
          adminPermissions: data.adminPermissions ?? [],
          gradeLevelHead: data.gradeLevelHead ?? null,
          isAdviser: Boolean(data.isAdviser),
        });
        if (data.profile.role === "staff_administrator") {
          const attention = await fetch("/api/teacher-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "profile_attention" }),
            signal: controller.signal,
          });
          if (attention.ok) {
            const result = await attention.json();
            if (active) setHasPersonnelProfile(Boolean(result.self));
          }
        }
      } catch (err) {
        if (active && !controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to connect. Please try again.",
          );
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [retry]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let busy = false;
    const controller = new AbortController();
    async function refreshUnread() {
      if (document.visibilityState !== "visible" || busy) return;
      busy = true;
      try {
        const response = await fetch("/api/community?summary=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (active && response.ok)
          setCommunityUnread(Number(data.unread_count ?? 0));
      } catch {
        /* Unread badges must never block the workspace. */
      } finally {
        busy = false;
      }
    }
    void refreshUnread();
    const timer = window.setInterval(refreshUnread, 20_000);
    document.addEventListener("visibilitychange", refreshUnread);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshUnread);
    };
  }, [session?.profile.id]);

  const groups = useMemo(
    () =>
      session
        ? portalNavigation({
            role: session.profile.role,
            permissions: session.adminPermissions,
            isAdviser: session.isAdviser,
            hasPersonnelProfile,
            gradeLevelHead: session.gradeLevelHead?.grade_level ?? null,
          })
        : [],
    [session, hasPersonnelProfile],
  );
  if (!session)
    return error ? (
      <div className={styles.loading} role="alert">
        <strong>We Couldn’t Open Your Workspace</strong>
        <p>{error}</p>
        <button onClick={() => setRetry((value) => value + 1)}>
          Try Again
        </button>
        <a href="/">Return to Sign In</a>
      </div>
    ) : (
      <PortalLoading />
    );
  return (
    <PortalContext.Provider value={{ session, groups, communityUnread }}>
      <SidebarProvider
        className={styles.shell}
        style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}
      >
        <PortalFrame>{children}</PortalFrame>
      </SidebarProvider>
    </PortalContext.Provider>
  );
}

function PortalFrame({ children }: { children: ReactNode }) {
  const { session, groups, communityUnread } = usePortal();
  const { profile } = session;
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { setOpenMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    academics: true,
  });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const searchButton = useRef<HTMLButtonElement>(null);
  const current = activePortalFeature(groups, pathname, params.toString());
  const searchGroups = searchPortalFeatures(groups, query);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setOpenMobile(false);
      content.current?.focus({ preventScroll: true });
    }
  }, [pathname, setOpenMobile]);

  const activeGroupId = current?.group.id;
  const activeItemId = current?.item.id;
  useEffect(() => {
    if (activeGroupId)
      setExpanded((value) =>
        value[activeGroupId] ? value : { ...value, [activeGroupId]: true },
      );
  }, [activeGroupId, activeItemId]);

  const navigate = useCallback(
    (href: string) => {
      setOpenMobile(false);
      setSearchOpen(false);
      setQuery("");
      // Older module filters initialize from the URL only on mount. Preserve that behavior.
      const target = new URL(href, window.location.origin);
      if (
        target.pathname === pathname &&
        pathname !== "/portal" &&
        target.search !== window.location.search
      ) {
        window.location.assign(href);
        return;
      }
      startTransition(() => router.push(href));
    },
    [pathname, router, setOpenMobile],
  );

  function internalLink(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self") ||
      anchor.dataset.nativeNavigation === "true"
    )
      return;
    const target = new URL(anchor.href, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      !(
        target.pathname === "/portal" || target.pathname.startsWith("/portal/")
      ) ||
      target.hash ||
      target.pathname.endsWith("/print")
    )
      return;
    if (
      target.pathname === pathname &&
      pathname !== "/portal" &&
      target.search !== window.location.search
    )
      return;
    event.preventDefault();
    navigate(target.pathname + target.search);
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      window.location.assign("/");
    } catch (err) {
      setSignOutError(
        err instanceof Error ? err.message : "Unable to sign out.",
      );
      setSigningOut(false);
    }
  }

  // A dedicated print route keeps its existing full-width layout.
  if (pathname.endsWith("/print"))
    return <div className={styles.printRoute}>{children}</div>;

  return (
    <div className={styles.frame} onClick={internalLink}>
      <a className={styles.skipLink} href="#portal-content">
        Skip to Content
      </a>
      <Sidebar className={styles.sidebar}>
        <SidebarHeader className={styles.brand}>
          <a href="/portal">
            <img
              src="/school-logo.png"
              alt="Asuncion National High School"
              width={44}
              height={44}
            />
            <span>
              <strong>ASUNCION NHS</strong>
              <small>Academic Portal</small>
            </span>
          </a>
          <button
            className={styles.closeMenu}
            aria-label="Close Menu"
            onClick={() => setOpenMobile(false)}
          >
            <X size={20} />
          </button>
        </SidebarHeader>
        <SidebarContent className={styles.sidebarContent}>
          <div className={styles.schoolYear}>
            <span>School Year</span>
            <strong>
              {session.academicContext?.school_year ?? "Current School Year"}
            </strong>
            <span className={styles.schoolYearDot} aria-hidden="true" />
          </div>
          <nav aria-label="Portal Features" className={styles.navigation}>
            {groups.map((group) => {
              const activeGroup = current?.group.id === group.id;
              const isExpanded =
                group.id === "home" || (expanded[group.id] ?? activeGroup);
              return (
                <section className={styles.group} key={group.id}>
                  {group.id !== "home" && (
                    <button
                      className={styles.groupToggle}
                      aria-expanded={isExpanded}
                      aria-controls={`portal-group-${group.id}`}
                      onClick={() =>
                        setExpanded((value) => ({
                          ...value,
                          [group.id]: !isExpanded,
                        }))
                      }
                    >
                      <FeatureIcon name={group.icon} size={17} />
                      <span>{group.label}</span>
                      <ChevronDown
                        size={14}
                        className={isExpanded ? styles.rotated : ""}
                      />
                    </button>
                  )}
                  <div
                    id={`portal-group-${group.id}`}
                    hidden={!isExpanded}
                    className={styles.groupItems}
                  >
                    {group.items.map((item) => (
                      <a
                        key={item.id}
                        href={item.href}
                        className={styles.navItem}
                        aria-current={
                          current?.item.id === item.id ? "page" : undefined
                        }
                        title={item.description}
                      >
                        <FeatureIcon name={item.icon} size={18} />
                        <span>{item.label}</span>
                        {item.id === "community" && communityUnread > 0 && (
                          <span
                            className={styles.badge}
                            aria-label={`${communityUnread} unread messages`}
                          >
                            {communityUnread > 99 ? "99+" : communityUnread}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>
        </SidebarContent>
        <SidebarFooter className={styles.sidebarFooter}>
          <a href="/portal/profile" className={styles.sideIdentity}>
            <ProfileAvatar
              userId={profile.id}
              name={profile.full_name}
              hasPhoto={Boolean(profile.has_profile_photo)}
              version={profile.profile_photo_updated_at}
              size={36}
              className={styles.sideAvatar}
            />
            <span className={styles.sideIdentityText}>
              <strong>{profile.full_name}</strong>
              <small>{roleName(session)}</small>
            </span>
          </a>
          {signOutError && (
            <p className={styles.signOutError} role="alert">
              {signOutError}
            </p>
          )}
          <button
            className={styles.signOut}
            disabled={signingOut}
            onClick={signOut}
          >
            <LogOut size={16} />
            {signingOut ? "Signing Out…" : "Sign Out"}
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <SidebarTrigger
              className={styles.menuToggle}
              aria-label="Toggle Navigation"
            />
            <a href="/portal" className={styles.homeCrumb}>
              Workspace
            </a>
            <ChevronRight size={14} />
            <span>{current?.item.label ?? "School Tools"}</span>
          </div>
          <div className={styles.topActions}>
            <Dialog
              open={searchOpen}
              onOpenChange={(open) => {
                setSearchOpen(open);
                if (!open) setQuery("");
              }}
            >
              <DialogTrigger asChild>
                <button
                  ref={searchButton}
                  className={styles.searchButton}
                  aria-label="Find a Feature"
                >
                  <Search size={17} />
                  <span>Find a Feature</span>
                  <kbd>Ctrl K</kbd>
                </button>
              </DialogTrigger>
              <DialogContent
                className={styles.searchDialog}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  searchButton.current?.focus();
                }}
              >
                <DialogTitle className={styles.searchTitle}>
                  Find a Feature
                </DialogTitle>
                <DialogDescription className={styles.searchDescription}>
                  Search your tools by name or task.
                </DialogDescription>
                <Command shouldFilter={false}>
                  <CommandInput
                    aria-label="Search Portal Features"
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Try attendance, report cards, or service credits…"
                  />
                  <CommandList className={styles.searchResults}>
                    <CommandEmpty>
                      No matching features. Try a shorter search.
                    </CommandEmpty>
                    {searchGroups.map((group) => (
                      <CommandGroup key={group.id} heading={group.label}>
                        {group.items.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.id}
                            onSelect={() => navigate(item.href)}
                            className={styles.searchResult}
                          >
                            <FeatureIcon name={item.icon} />
                            <span>
                              <strong>{item.label}</strong>
                              <small>{item.description}</small>
                            </span>
                            <ArrowRight size={16} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
                <p className={styles.searchHint}>
                  ↑ ↓ to browse · Enter to open · Esc to close
                </p>
              </DialogContent>
            </Dialog>
            <a
              href="/portal/community"
              className={styles.chatShortcut}
              aria-label={
                communityUnread
                  ? `Community Chat, ${communityUnread} unread messages`
                  : "Community Chat"
              }
            >
              <FeatureIcon name="message" />
              {communityUnread > 0 && <span className={styles.chatDot} />}
            </a>
          </div>
        </header>
        {pending && (
          <div
            className={styles.routeProgress}
            role="status"
            aria-label="Opening Page"
          >
            <span />
          </div>
        )}
        <div
          className={styles.content}
          id="portal-content"
          ref={content}
          tabIndex={-1}
          aria-busy={pending}
          data-portal-content
        >
          {children}
        </div>
      </div>
    </div>
  );
}

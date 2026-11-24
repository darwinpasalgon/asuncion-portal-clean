"use client";
import { useState, type MouseEvent } from "react";
import { Bell, CheckCheck, ClipboardCheck, MessageCircle, RefreshCw, UserRound, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PortalNotification } from "@/lib/portal-attention";
import styles from "./portal-notifications.module.css";

export default function PortalNotifications({ items, loading, error, refresh, navigate }: {
  items: PortalNotification[]; loading: boolean; error: boolean; refresh: () => void; navigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = items.length;
  function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href); setOpen(false);
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className={styles.trigger} title="Notifications"
        aria-label={count ? "Notifications, " + count + " updates need attention" : error ? "Notifications, refresh unavailable" : "Notifications"}>
        <Bell size={20} aria-hidden="true" />
        {count > 0 && <span className={styles.badge} key={count} aria-hidden="true">{count > 99 ? "99+" : count}</span>}
        {!count && error && <span className={styles.unavailable} aria-hidden="true" />}
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} collisionPadding={12} className={styles.panel} aria-label="Portal notifications">
      <div className={styles.header}>
        <div><h2>Notifications</h2><p>{count ? count + " update" + (count === 1 ? "" : "s") + " need your attention" : "Your school updates"}</p></div>
        <button type="button" onClick={refresh} disabled={loading} className={styles.refresh} aria-label="Refresh notifications"><RefreshCw size={17} aria-hidden="true" className={loading ? styles.spin : undefined} /></button>
      </div>
      {error && <p className={styles.error} role="status">Some updates could not refresh. Please try again.</p>}
      {loading && !count ? <p className={styles.empty} role="status">Checking your updates…</p>
        : !count && !error ? <div className={styles.empty}><CheckCheck size={28} aria-hidden="true" /><strong>You’re all caught up</strong><span>New reminders will appear here.</span></div>
        : <div className={styles.list}>{items.map(item => {
          const Icon = item.kind === "profile" ? UserRound : item.kind === "adviser" ? ClipboardCheck : item.kind === "message" ? MessageCircle : Users;
          const copy = <><span className={styles.itemIcon}><Icon size={19} aria-hidden="true" /></span><div><strong>{item.title}</strong><p>{item.detail}</p>{item.href && <small>{item.kind === "message" ? "Open conversation" : "Review update"} <span aria-hidden="true">↗</span></small>}</div><span className={styles.dot} aria-hidden="true" /></>;
          return item.href
            ? <a key={item.id} href={item.href} className={styles.item} onClick={event => follow(event, item.href!)}>{copy}</a>
            : <article key={item.id} className={styles.item}>{copy}</article>;
        })}</div>}
      <p className={styles.footer}>Profile and advisory reminders clear when the required information is updated.</p>
    </PopoverContent>
  </Popover>;
}


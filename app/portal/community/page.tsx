"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  MessageCircle,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./community.module.css";

type Role = "student" | "teacher" | "administrator" | "staff_administrator";

type Member = {
  user_id: string;
  display_name: string;
  role: Role;
  last_seen: string;
};

type Message = {
  id: string;
  user_id: string;
  sender_name: string;
  sender_role: Role;
  body: string;
  created_at: string;
};

type Mute = {
  user_id: string;
  muted_until: string | null;
  reason: string | null;
};

type Report = {
  id: string;
  message_id: string | null;
  reported_user_id: string;
  reporter_id: string;
  reporter_name: string;
  sender_name: string;
  sender_role: Role;
  message_body: string;
  reason: string;
  status: "pending";
  created_at: string;
};

type CommunityState = {
  me: {
    id: string;
    full_name: string;
    role: Role;
    is_admin: boolean;
  };
  messages: Message[];
  online: Member[];
  muted: Mute | null;
  mutes: Mute[];
  reports: Report[];
  unread_count: number;
  read_state: {
    last_read_at: string;
  };
};

const roleLabel: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  administrator: "Super Administrator",
  staff_administrator: "Administrator",
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AN"
  );
}

function messageTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function messageDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export default function CommunityPage() {
  const [community, setCommunity] = useState<CommunityState | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(true);
  const [readBoundary, setReadBoundary] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const readBoundaryRef = useRef<string | null>(null);
  const lastMarkedReadRef = useRef<string | null>(null);

  const markRead = useCallback(async (messages: Message[]) => {
    const latest = messages[messages.length - 1]?.created_at;
    if (!latest || latest === lastMarkedReadRef.current) return;
    lastMarkedReadRef.current = latest;

    try {
      await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", lastReadAt: latest }),
        cache: "no-store",
      });
    } catch {
      // Read state is best-effort and will retry on the next update.
    }
  }, []);

  const loadCommunity = useCallback(
    async (quiet = false) => {
      try {
        const response = await fetch("/api/community", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!quiet) setError(result.error ?? "Unable to load My Community.");
          setConnected(false);
          return;
        }

        const next = result as CommunityState;
        if (!readBoundaryRef.current) {
          const boundary = next.read_state?.last_read_at ?? new Date().toISOString();
          readBoundaryRef.current = boundary;
          setReadBoundary(boundary);
        }

        setCommunity(next);
        setConnected(true);
        if (!quiet) setError("");

        if (document.visibilityState === "visible") {
          void markRead(next.messages ?? []);
        }
      } catch {
        setConnected(false);
        if (!quiet) setError("Unable to reach My Community.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [markRead]
  );

  useEffect(() => {
    void loadCommunity();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCommunity(true);
      }
    }, 2000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadCommunity(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadCommunity]);

  useEffect(() => {
    if (!community?.messages.length) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      bottomRef.current?.scrollIntoView();
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [community?.messages.length]);

  const mutedUserIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      (community?.mutes ?? [])
        .filter(
          (mute) =>
            !mute.muted_until ||
            new Date(mute.muted_until).getTime() > now
        )
        .map((mute) => mute.user_id)
    );
  }, [community?.mutes]);

  const activeMute = useMemo(() => {
    const mute = community?.muted;
    if (!mute) return null;
    if (!mute.muted_until) return mute;
    return new Date(mute.muted_until).getTime() > Date.now() ? mute : null;
  }, [community?.muted]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: Message[] }> = [];
    for (const message of community?.messages ?? []) {
      const label = messageDate(message.created_at);
      const last = groups[groups.length - 1];
      if (!last || last.date !== label) {
        groups.push({ date: label, messages: [message] });
      } else {
        last.messages.push(message);
      }
    }
    return groups;
  }, [community?.messages]);

  const firstUnreadId = useMemo(() => {
    if (!community?.me.id || !readBoundary) return null;
    const boundary = new Date(readBoundary).getTime();
    return (
      community.messages.find(
        (message) =>
          message.user_id !== community.me.id &&
          new Date(message.created_at).getTime() > boundary
      )?.id ?? null
    );
  }, [community?.me.id, community?.messages, readBoundary]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sending || activeMute) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to send the message.");
        await loadCommunity(true);
        return;
      }

      setDraft("");
      await loadCommunity(true);
    } catch {
      setError("Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function deleteMessage(messageId: string) {
    setWorking(messageId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", messageId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to remove this message.");
        return;
      }
      setNotice("Message removed.");
      await loadCommunity(true);
    } finally {
      setWorking("");
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!reportTarget || reporting) return;

    const reason = reportReason.trim();
    if (reason.length < 3) {
      setError("Please provide a brief reason for the report.");
      return;
    }

    setReporting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          messageId: reportTarget.id,
          reason,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to submit the report.");
        return;
      }

      setReportTarget(null);
      setReportReason("");
      setNotice("Message reported to the Super Administrator.");
      await loadCommunity(true);
    } finally {
      setReporting(false);
    }
  }

  async function reviewReport(
    reportId: string,
    action: "dismiss_report" | "remove_reported_message"
  ) {
    setWorking(`report:${reportId}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reportId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to review this report.");
        return;
      }

      setNotice(
        action === "remove_reported_message"
          ? "Reported message removed and report resolved."
          : "Report dismissed."
      );
      await loadCommunity(true);
    } finally {
      setWorking("");
    }
  }

  async function toggleMute(userId: string, isMuted: boolean) {
    setWorking(`mute:${userId}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isMuted
            ? { action: "unmute", userId }
            : {
                action: "mute",
                userId,
                minutes: 60,
                reason: "Temporarily muted by Super Administrator",
              }
        ),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Unable to update community access.");
        return;
      }
      await loadCommunity(true);
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        <MessageCircle size={32} />
        <strong>Opening My Community…</strong>
        <span>Connecting to the ANHS Community Chat</span>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <a href="/portal" className={styles.back}>
              <ArrowLeft size={16} />
              Back to Portal
            </a>
            <div className={styles.title}>
              <div className={styles.titleIcon}>
                <MessageCircle size={24} />
              </div>
              <div>
                <span>MY COMMUNITY</span>
                <h1>ANHS Community Chat</h1>
                <p>School-only conversation for active portal members.</p>
              </div>
            </div>
          </div>

          <div className={connected ? styles.connection : styles.connectionOffline}>
            <Circle size={9} fill="currentColor" />
            {connected ? "Auto Updates" : "Reconnecting"}
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {notice && (
          <div className={styles.notice}>
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}

        <div className={styles.communityGrid}>
          <section className={styles.chatPanel}>
            <div className={styles.roomHeader}>
              <div>
                <strong># General Community</strong>
                <span>
                  Be respectful. Messages are visible to authenticated ANHS portal members.
                </span>
              </div>
              <div className={styles.roomOnline}>
                <Users size={15} />
                {community?.online.length ?? 0} online
              </div>
            </div>

            <div className={styles.messages}>
              {(community?.messages.length ?? 0) === 0 ? (
                <div className={styles.emptyMessages}>
                  <MessageCircle size={32} />
                  <strong>No Messages Yet</strong>
                  <span>Start the first conversation in the ANHS Community.</span>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date} className={styles.messageDay}>
                    <div className={styles.dateDivider}>
                      <span>{group.date}</span>
                    </div>

                    {group.messages.map((message) => {
                      const mine = message.user_id === community?.me.id;
                      const canDelete = mine || Boolean(community?.me.is_admin);
                      const canMute =
                        Boolean(community?.me.is_admin) &&
                        !mine &&
                        message.sender_role !== "administrator";
                      const canReport = !mine;
                      const muted = mutedUserIds.has(message.user_id);

                      return (
                        <Fragment key={message.id}>
                          {message.id === firstUnreadId && (
                            <div className={styles.newMessagesDivider}>
                              <span>New Messages</span>
                            </div>
                          )}

                          <article
                            className={mine ? styles.messageOwn : styles.message}
                          >
                            {!mine && (
                              <div className={styles.avatar}>
                                {initials(message.sender_name)}
                              </div>
                            )}

                            <div className={styles.messageContent}>
                              <div className={styles.messageMeta}>
                                <strong>{mine ? "You" : message.sender_name}</strong>
                                <span className={styles.roleBadge}>
                                  {roleLabel[message.sender_role]}
                                </span>
                                <time>
                                  <Clock3 size={11} />
                                  {messageTime(message.created_at)}
                                </time>
                              </div>

                              <div className={styles.bubble}>
                                <p>{message.body}</p>
                              </div>

                              {(canDelete || canMute || canReport) && (
                                <div className={styles.messageActions}>
                                  {canReport && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReportTarget(message);
                                        setReportReason("");
                                        setError("");
                                      }}
                                    >
                                      <Flag size={12} />
                                      Report
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      disabled={working === message.id}
                                      onClick={() => void deleteMessage(message.id)}
                                    >
                                      <Trash2 size={12} />
                                      Remove
                                    </button>
                                  )}

                                  {canMute && (
                                    <button
                                      type="button"
                                      disabled={working === `mute:${message.user_id}`}
                                      onClick={() =>
                                        void toggleMute(message.user_id, muted)
                                      }
                                    >
                                      {muted ? (
                                        <Volume2 size={12} />
                                      ) : (
                                        <VolumeX size={12} />
                                      )}
                                      {muted ? "Unmute" : "Mute 1 Hour"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        </Fragment>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className={styles.composerWrap}>
              {activeMute && (
                <div className={styles.mutedNotice}>
                  <VolumeX size={16} />
                  <div>
                    <strong>You are temporarily muted.</strong>
                    <span>
                      {activeMute.muted_until
                        ? `Posting is disabled until ${new Intl.DateTimeFormat(
                            "en-PH",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              month: "short",
                              day: "numeric",
                            }
                          ).format(new Date(activeMute.muted_until))}.`
                        : "Posting is currently disabled for your account."}
                    </span>
                  </div>
                </div>
              )}

              <form className={styles.composer} onSubmit={sendMessage}>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={draft}
                  disabled={sending || Boolean(activeMute)}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    activeMute
                      ? "You are temporarily muted."
                      : "Write a message to the ANHS Community…"
                  }
                />
                <div className={styles.composerFooter}>
                  <span>{draft.length}/1000 · Enter to send · Shift+Enter for new line</span>
                  <button
                    type="submit"
                    disabled={
                      sending || Boolean(activeMute) || !draft.trim()
                    }
                  >
                    <Send size={16} />
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className={styles.membersPanel}>
            <div className={styles.membersHeading}>
              <div>
                <Users size={18} />
                <div>
                  <strong>Online Now</strong>
                  <span>{community?.online.length ?? 0} active member(s)</span>
                </div>
              </div>
            </div>

            <div className={styles.memberList}>
              {(community?.online.length ?? 0) === 0 ? (
                <div className={styles.noMembers}>No members online yet.</div>
              ) : (
                community?.online.map((member) => {
                  const mine = member.user_id === community.me.id;
                  const muted = mutedUserIds.has(member.user_id);
                  return (
                    <div className={styles.member} key={member.user_id}>
                      <div className={styles.memberAvatar}>
                        {initials(member.display_name)}
                        <span />
                      </div>
                      <div className={styles.memberInfo}>
                        <strong>{mine ? "You" : member.display_name}</strong>
                        <span>{roleLabel[member.role]}</span>
                      </div>
                      {muted && (
                        <span className={styles.mutedIcon} title="Muted">
                          <VolumeX size={13} />
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {community?.me.is_admin && (
              <section className={styles.moderationPanel}>
                <div className={styles.moderationHeading}>
                  <div>
                    <ShieldAlert size={16} />
                    <strong>Reported Messages</strong>
                  </div>
                  <span>{community.reports?.length ?? 0}</span>
                </div>

                {(community.reports?.length ?? 0) === 0 ? (
                  <div className={styles.noReports}>
                    <CheckCircle2 size={16} />
                    No pending reports.
                  </div>
                ) : (
                  <div className={styles.reportList}>
                    {community.reports.map((report) => (
                      <article key={report.id} className={styles.reportCard}>
                        <div className={styles.reportMeta}>
                          <strong>{report.sender_name}</strong>
                          <span>{roleLabel[report.sender_role]}</span>
                        </div>
                        <p>{report.message_body}</p>
                        <div className={styles.reportReason}>
                          <AlertTriangle size={13} />
                          <span>{report.reason}</span>
                        </div>
                        <small>Reported by {report.reporter_name}</small>
                        <div className={styles.reportActions}>
                          <button
                            type="button"
                            disabled={working === `report:${report.id}`}
                            onClick={() =>
                              void reviewReport(report.id, "dismiss_report")
                            }
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            className={styles.removeReported}
                            disabled={working === `report:${report.id}`}
                            onClick={() =>
                              void reviewReport(
                                report.id,
                                "remove_reported_message"
                              )
                            }
                          >
                            <Trash2 size={12} />
                            Remove Message
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            <div className={styles.communityRules}>
              <Shield size={17} />
              <div>
                <strong>ANHS Community Guidelines</strong>
                <span>
                  Use your real portal identity, keep conversations respectful,
                  and avoid sharing private learner or personnel information.
                </span>
              </div>
            </div>

            {community?.me.is_admin && (
              <div className={styles.adminHint}>
                <UserRound size={16} />
                <div>
                  <strong>Moderator Mode</strong>
                  <span>
                    Reports are private. You can dismiss them, remove reported
                    messages, or temporarily mute members.
                  </span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {reportTarget && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !reporting) {
              setReportTarget(null);
              setReportReason("");
            }
          }}
        >
          <form className={styles.reportModal} onSubmit={submitReport}>
            <div className={styles.reportModalHeading}>
              <div>
                <Flag size={18} />
                <div>
                  <strong>Report Message</strong>
                  <span>This report is visible only to the Super Administrator.</span>
                </div>
              </div>
              <button
                type="button"
                disabled={reporting}
                onClick={() => {
                  setReportTarget(null);
                  setReportReason("");
                }}
                aria-label="Close report dialog"
              >
                <X size={17} />
              </button>
            </div>

            <div className={styles.reportPreview}>
              <strong>{reportTarget.sender_name}</strong>
              <p>{reportTarget.body}</p>
            </div>

            <label className={styles.reportField}>
              <span>Why are you reporting this message?</span>
              <textarea
                required
                rows={4}
                minLength={3}
                maxLength={500}
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="Example: Bullying, inappropriate language, spam, or sharing private information."
              />
              <small>{reportReason.length}/500</small>
            </label>

            <div className={styles.reportModalActions}>
              <button
                type="button"
                disabled={reporting}
                onClick={() => {
                  setReportTarget(null);
                  setReportReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reporting || reportReason.trim().length < 3}
              >
                <Flag size={14} />
                {reporting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

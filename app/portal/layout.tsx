import CommunityPresenceHeartbeat from "@/components/community-presence-heartbeat";
import { Suspense } from "react";
import PortalShell, { PortalLoading } from "@/components/portal/portal-shell";

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <CommunityPresenceHeartbeat />
      <Suspense fallback={<PortalLoading />}>
        <PortalShell>{children}</PortalShell>
      </Suspense>
    </>
  );
}

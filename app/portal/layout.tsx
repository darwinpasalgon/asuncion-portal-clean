import CommunityPresenceHeartbeat from "@/components/community-presence-heartbeat";

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <CommunityPresenceHeartbeat />
      {children}
    </>
  );
}

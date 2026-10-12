"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";

type Props = {
  userId: string;
  name: string;
  hasPhoto?: boolean;
  version?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
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

export default function ProfileAvatar({
  userId,
  name,
  hasPhoto = true,
  version,
  size = 40,
  className,
  style,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [userId, hasPhoto, version]);

  const source = useMemo(() => {
    const params = new URLSearchParams({ userId });
    if (version) params.set("v", version);
    return `/api/profile-photo?${params.toString()}`;
  }, [userId, version]);

  const showPhoto = Boolean(userId && hasPhoto && !failed);

  return (
    <span
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        background: "#e3eee7",
        border: "1px solid #d5e3d9",
        color: "#386348",
        fontSize: Math.max(10, Math.round(size * 0.29)),
        fontWeight: 800,
        lineHeight: 1,
        ...style,
      }}
      aria-label={`${name} profile photo`}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {showPhoto && (
        <img
          src={source}
          alt=""
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </span>
  );
}

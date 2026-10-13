"use client";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImageOff,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import ProfileAvatar from "@/components/profile-avatar";
import styles from "./profile.module.css";

type Role = "student" | "teacher" | "administrator" | "staff_administrator";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  lrn: string | null;
  role: Role;
  position: string | null;
  has_profile_photo?: boolean;
  profile_photo_updated_at?: string | null;
};

type NameFields = {
  last_name: string;
  first_name: string;
  middle_name: string;
  name_extension: string;
};

type AcademicContext = {
  grade_level: number | null;
  section: string | null;
  school_year: string | null;
};

const roleLabels: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  administrator: "Super Administrator",
  staff_administrator: "Administrator",
};

async function cropAndCompress(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Please choose an image smaller than 10 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const crop = Math.min(bitmap.width, bitmap.height);
  const sx = Math.max(0, (bitmap.width - crop) / 2);
  const sy = Math.max(0, (bitmap.height - crop) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to prepare this image.");
  }

  context.drawImage(bitmap, sx, sy, crop, crop, 0, 0, 512, 512);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86)
  );

  if (!blob) {
    throw new Error("Unable to prepare this image.");
  }

  if (blob.size > 2 * 1024 * 1024) {
    throw new Error("The processed profile photo is still larger than 2 MB.");
  }

  return new File([blob], "profile-photo.webp", { type: "image/webp" });
}

export default function MyProfilePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicContext, setAcademicContext] = useState<AcademicContext | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [name, setName] = useState<NameFields>({
    last_name: "",
    first_name: "",
    middle_name: "",
    name_extension: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? "Unable to load your profile.");
      }

      const next = result.profile as Profile;
      setProfile(next);
      setAcademicContext((result.academicContext ?? null) as AcademicContext | null);
      setHasPhoto(Boolean(next.has_profile_photo));
      setPhotoVersion(next.profile_photo_updated_at ?? null);

      if (next.role !== "student") {
        const nameResponse = await fetch("/api/teacher-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_name" }),
          cache: "no-store",
        });
        const nameResult = await nameResponse.json().catch(() => ({}));
        if (nameResponse.ok && nameResult.name) {
          setName({
            last_name: String(nameResult.name.last_name ?? ""),
            first_name: String(nameResult.name.first_name ?? ""),
            middle_name: String(nameResult.name.middle_name ?? ""),
            name_extension: String(nameResult.name.name_extension ?? ""),
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || !profile) return;

    setWorking(true);
    setError("");
    setNotice("");

    try {
      const prepared = await cropAndCompress(selected);
      const form = new FormData();
      form.append("file", prepared);

      const response = await fetch("/api/profile-photo", {
        method: "POST",
        body: form,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to upload the profile photo.");
      }

      setHasPhoto(true);
      setPhotoVersion(
        String(result.profile_photo_updated_at ?? Date.now())
      );
      setNotice("Profile photo updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to upload the profile photo."
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveName() {
    if (!profile || profile.role === "student" || savingName) return;
    if (!name.first_name.trim() || !name.last_name.trim()) {
      setError("First Name and Last Name are required.");
      return;
    }

    setSavingName(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/teacher-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_name", name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update your name.");
      }

      setProfile((current) =>
        current ? { ...current, full_name: String(result.full_name ?? current.full_name) } : current
      );
      if (result.name) {
        setName({
          last_name: String(result.name.last_name ?? ""),
          first_name: String(result.name.first_name ?? ""),
          middle_name: String(result.name.middle_name ?? ""),
          name_extension: String(result.name.name_extension ?? ""),
        });
      }
      setNotice("Name updated across your personnel and portal profile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your name.");
    } finally {
      setSavingName(false);
    }
  }

  async function removePhoto() {
    if (!profile || working) return;

    setWorking(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to remove the profile photo.");
      }

      setHasPhoto(false);
      setPhotoVersion(null);
      setNotice("Profile photo removed. Your initials will be shown instead.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove the profile photo."
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading || !profile) {
    return (
      <main className={styles.loading}>
        <UserRound size={34} />
        <strong>Opening My Profile…</strong>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/portal">
          <ArrowLeft size={16} />
          Back to Portal
        </a>

        <header className={styles.header}>
          <div className={styles.photoWrap}>
            <ProfileAvatar
              userId={profile.id}
              name={profile.full_name}
              hasPhoto={hasPhoto}
              version={photoVersion}
              size={112}
              className={styles.avatar}
            />
            <span className={styles.cameraBadge}>
              <Camera size={16} />
            </span>
          </div>

          <div className={styles.headerCopy}>
            <span>MY PROFILE</span>
            <h1>{profile.full_name}</h1>
            <p>{roleLabels[profile.role]} · Asuncion National High School</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {notice && (
          <div className={styles.notice}>
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <Camera size={20} />
            <div>
              <h2>Display Photo</h2>
              <p>
                Optional. Your photo will appear in the portal and Community Chat.
              </p>
            </div>
          </div>

          <div className={styles.photoControls}>
            <div className={styles.photoPreview}>
              <ProfileAvatar
                userId={profile.id}
                name={profile.full_name}
                hasPhoto={hasPhoto}
                version={photoVersion}
                size={144}
              />
            </div>

            <div className={styles.photoActions}>
              <strong>{hasPhoto ? "Profile Photo Active" : "Using Initials"}</strong>
              <p>
                JPG, PNG, or WebP. The photo is automatically center-cropped to a
                square and compressed before upload. Maximum stored size is 2 MB.
              </p>
              <p className={styles.privacy}>
                <ShieldCheck size={15} />
                Visible only inside the signed-in ANHS portal.
              </p>

              <div className={styles.buttons}>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={16} />
                  {working ? "Please Wait…" : hasPhoto ? "Replace Photo" : "Upload Photo"}
                </button>
                {hasPhoto && (
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={working}
                    onClick={() => void removePhoto()}
                  >
                    <ImageOff size={16} />
                    Remove Photo
                  </button>
                )}
              </div>

              <input
                ref={inputRef}
                className={styles.fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
              />
            </div>
          </div>
        </section>

        {profile.role !== "student" && (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <UserRound size={20} />
              <div>
                <h2>Name</h2>
                <p>
                  Personnel accounts may correct their own name. This updates the
                  display name used across the portal.
                </p>
              </div>
            </div>

            <div className={styles.nameGrid}>
              <label>
                <span>Last Name</span>
                <input
                  value={name.last_name}
                  onChange={(event) =>
                    setName((current) => ({ ...current, last_name: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>First Name</span>
                <input
                  value={name.first_name}
                  onChange={(event) =>
                    setName((current) => ({ ...current, first_name: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Middle Name</span>
                <input
                  value={name.middle_name}
                  onChange={(event) =>
                    setName((current) => ({ ...current, middle_name: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Name Extension</span>
                <input
                  value={name.name_extension}
                  onChange={(event) =>
                    setName((current) => ({ ...current, name_extension: event.target.value }))
                  }
                  placeholder="JR., SR., III"
                />
              </label>
            </div>

            <div className={styles.nameActions}>
              <button
                type="button"
                disabled={savingName}
                onClick={() => void saveName()}
              >
                <Save size={16} />
                {savingName ? "Saving Name…" : "Save Name"}
              </button>
              <span>Learner names remain locked from learner accounts.</span>
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <UserRound size={20} />
            <div>
              <h2>Portal Identity</h2>
              <p>Your school-managed account information.</p>
            </div>
          </div>

          <dl className={styles.details}>
            <div>
              <dt>Full Name</dt>
              <dd>{profile.full_name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabels[profile.role]}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile.email || "Not recorded"}</dd>
            </div>
            {profile.lrn && (
              <div>
                <dt>LRN</dt>
                <dd>{profile.lrn}</dd>
              </div>
            )}
            {academicContext?.grade_level !== null &&
              academicContext?.grade_level !== undefined && (
                <div>
                  <dt>Grade & Section</dt>
                  <dd>
                    {academicContext.grade_level === 0
                      ? "ALS A&E"
                      : `Grade ${academicContext.grade_level}`}
                    {academicContext.section
                      ? ` · ${academicContext.section}`
                      : ""}
                  </dd>
                </div>
              )}
            {profile.position && (
              <div>
                <dt>Position</dt>
                <dd>{profile.position}</dd>
              </div>
            )}
          </dl>
        </section>

        {(profile.role === "teacher" ||
          profile.role === "administrator" ||
          profile.role === "staff_administrator") && (
          <a className={styles.personnelLink} href="/portal/teacher-profile">
            <UserRound size={18} />
            <div>
              <strong>
                {profile.role === "teacher"
                  ? "Open My Teacher Profile"
                  : "Open My Personnel Profile"}
              </strong>
              <span>
                View and update your detailed personnel and education information.
              </span>
            </div>
          </a>
        )}
      </div>
    </main>
  );
}

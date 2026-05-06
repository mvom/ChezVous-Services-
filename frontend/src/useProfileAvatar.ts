import { Dispatch, SetStateAction, useRef, useState } from "react";

import type { UserProfile } from "./types";

type UseProfileAvatarDeps = {
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  jsonHeaders: () => HeadersInit;
};

type UseProfileAvatarResult = {
  userProfile: UserProfile | null;
  setUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
  avatarUploadPending: boolean;
  setAvatarUploadPending: Dispatch<SetStateAction<boolean>>;
  queuePendingAvatarUpload: (avatarDataUrl: string) => void;
  fetchUserProfile: () => Promise<void>;
};

export function useProfileAvatar({ apiFetch, jsonHeaders }: UseProfileAvatarDeps): UseProfileAvatarResult {
  const pendingAvatarRef = useRef<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [avatarUploadPending, setAvatarUploadPending] = useState(false);

  function queuePendingAvatarUpload(avatarDataUrl: string): void {
    pendingAvatarRef.current = avatarDataUrl;
  }

  async function fetchUserProfile(): Promise<void> {
    try {
      const profile = await apiFetch<UserProfile>("/auth/me");
      setUserProfile(profile);

      if (pendingAvatarRef.current) {
        const avatarData = pendingAvatarRef.current;
        pendingAvatarRef.current = null;
        await apiFetch<UserProfile>("/auth/me/avatar", {
          method: "PATCH",
          headers: jsonHeaders(),
          body: JSON.stringify({ avatar_url: avatarData }),
        });
        setUserProfile((prev) => (prev ? { ...prev, avatar_url: avatarData } : prev));
      }
    } catch {
      // Non-critical.
    }
  }

  return {
    userProfile,
    setUserProfile,
    avatarUploadPending,
    setAvatarUploadPending,
    queuePendingAvatarUpload,
    fetchUserProfile,
  };
}

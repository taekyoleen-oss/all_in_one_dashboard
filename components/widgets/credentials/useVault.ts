"use client";

/**
 * useVault — per-instance encrypted credential store backed by localStorage.
 *
 *  State machine:
 *    • "setup"    → no vault on this device yet; ask for a NEW master password.
 *    • "locked"   → a vault exists; ask for the master password to decrypt.
 *    • "unlocked" → decrypted; entries + the live key are held in memory only.
 *
 *  The plaintext entries and the derived key NEVER leave memory; only the
 *  AES-GCM ciphertext is persisted (localStorage, device-local — never Supabase).
 *  Auto-relocks a fixed `lockAfterMin` AFTER unlocking — an ABSOLUTE timer that
 *  keeps running regardless of activity (요구: 해제 후 일정 시간이 지나면 사용 중이어도
 *  무조건 잠긴다), and the in-memory key is lost on reload so it re-locks on restart.
 */

import * as React from "react";
import {
  createVaultKey,
  decryptVault,
  encryptEntries,
  newCredentialId,
  type Credential,
  type VaultBlob,
  type VaultKey,
} from "./types";

const PREFIX = "pb:credentials:";
const keyOf = (id: string) => PREFIX + id;

type Status = "setup" | "locked" | "unlocked";

function readBlob(instanceId: string): VaultBlob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyOf(instanceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultBlob;
    if (parsed && parsed.v === 1 && parsed.salt && parsed.iv && parsed.ct) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeBlob(instanceId: string, blob: VaultBlob): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(keyOf(instanceId), JSON.stringify(blob));
    return true;
  } catch {
    return false;
  }
}

export interface Vault {
  /** False until the localStorage read has run (client mount) — render nothing
   *  meanwhile so SSR and the first client render agree (no hydration mismatch). */
  ready: boolean;
  status: Status;
  entries: Credential[];
  error: string | null;
  busy: boolean;
  /** Create the vault with a brand-new master password (setup). */
  setup: (password: string) => Promise<void>;
  /** Decrypt the existing vault. Returns false on a wrong password. */
  unlock: (password: string) => Promise<boolean>;
  /** Relock now (clears the in-memory key + entries). */
  lock: () => void;
  /** Add an entry. */
  add: (entry: Omit<Credential, "id">) => Promise<void>;
  /** Patch an existing entry by id. */
  update: (id: string, patch: Partial<Omit<Credential, "id">>) => Promise<void>;
  /** Delete an entry by id. */
  remove: (id: string) => Promise<void>;
  /** Re-encrypt everything under a new master password. */
  changePassword: (newPassword: string) => Promise<void>;
  /** Wipe the vault from this device (irreversible). */
  reset: () => void;
  /** No-op — kept for API compatibility. The relock timer is ABSOLUTE (armed at
   *  unlock, never rearmed by activity), so interaction must NOT postpone it. */
  touch: () => void;
}

export function useVault(instanceId: string, lockAfterMin: number): Vault {
  // Start in a SSR-safe default; the real lock state is read from localStorage
  // in a mount effect (localStorage is unavailable on the server, so reading it
  // during render would make SSR and the first client render disagree).
  const [ready, setReady] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("setup");
  const [entries, setEntries] = React.useState<Credential[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const vkRef = React.useRef<VaultKey | null>(null);
  const relockTimer = React.useRef<number | null>(null);
  const relockMs = Math.max(1, lockAfterMin || 5) * 60_000;

  // On mount (and whenever the instance changes) derive the lock state from
  // storage. Runs client-only, so it never mismatches the server render.
  React.useEffect(() => {
    vkRef.current = null;
    setEntries([]);
    setError(null);
    setStatus(readBlob(instanceId) ? "locked" : "setup");
    setReady(true);
  }, [instanceId]);

  const doLock = React.useCallback(() => {
    vkRef.current = null;
    setEntries([]);
    setError(null);
    setStatus(readBlob(instanceId) ? "locked" : "setup");
  }, [instanceId]);

  // Arm the ABSOLUTE relock timer: locks `relockMs` after unlock/setup and is
  // NOT rearmed by subsequent activity (add/update/remove/touch), so the vault
  // always relocks a fixed time after it was opened (요구).
  const armRelock = React.useCallback(() => {
    if (relockTimer.current != null) window.clearTimeout(relockTimer.current);
    relockTimer.current = window.setTimeout(doLock, relockMs);
  }, [doLock, relockMs]);

  React.useEffect(
    () => () => {
      if (relockTimer.current != null) window.clearTimeout(relockTimer.current);
    },
    [],
  );

  const persist = React.useCallback(
    async (next: Credential[]) => {
      const vk = vkRef.current;
      if (!vk) return;
      const blob = await encryptEntries(next, vk);
      const ok = writeBlob(instanceId, blob);
      if (!ok) {
        setError("저장에 실패했습니다(기기 저장공간 확인).");
        return;
      }
      setEntries(next);
      setError(null);
    },
    [instanceId],
  );

  const setup = React.useCallback(
    async (password: string) => {
      const pw = password.trim();
      if (pw.length < 4) {
        setError("마스터 비밀번호는 4자 이상이어야 합니다.");
        return;
      }
      setBusy(true);
      try {
        const vk = await createVaultKey(pw);
        vkRef.current = vk;
        const blob = await encryptEntries([], vk);
        if (!writeBlob(instanceId, blob)) {
          setError("저장에 실패했습니다(기기 저장공간 확인).");
          vkRef.current = null;
          return;
        }
        setEntries([]);
        setError(null);
        setStatus("unlocked");
        armRelock();
      } finally {
        setBusy(false);
      }
    },
    [instanceId, armRelock],
  );

  const unlock = React.useCallback(
    async (password: string): Promise<boolean> => {
      const blob = readBlob(instanceId);
      if (!blob) {
        setStatus("setup");
        return false;
      }
      setBusy(true);
      try {
        const result = await decryptVault(blob, password.trim());
        if (!result) {
          setError("비밀번호가 올바르지 않습니다.");
          return false;
        }
        vkRef.current = result.vk;
        setEntries(result.entries);
        setError(null);
        setStatus("unlocked");
        armRelock();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [instanceId, armRelock],
  );

  const add = React.useCallback(
    async (entry: Omit<Credential, "id">) => {
      const next = [{ id: newCredentialId(), ...entry }, ...entries];
      await persist(next);
    },
    [entries, persist],
  );

  const update = React.useCallback(
    async (id: string, patch: Partial<Omit<Credential, "id">>) => {
      const next = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      await persist(next);
    },
    [entries, persist],
  );

  const remove = React.useCallback(
    async (id: string) => {
      await persist(entries.filter((e) => e.id !== id));
    },
    [entries, persist],
  );

  const changePassword = React.useCallback(
    async (newPassword: string) => {
      const pw = newPassword.trim();
      if (pw.length < 4) {
        setError("마스터 비밀번호는 4자 이상이어야 합니다.");
        return;
      }
      setBusy(true);
      try {
        const vk = await createVaultKey(pw); // new salt + key
        vkRef.current = vk;
        const blob = await encryptEntries(entries, vk);
        if (!writeBlob(instanceId, blob)) {
          setError("저장에 실패했습니다(기기 저장공간 확인).");
          return;
        }
        setError(null);
        // Absolute timer: don't rearm on password change — the vault still relocks
        // at its original unlock deadline.
      } finally {
        setBusy(false);
      }
    },
    [entries, instanceId],
  );

  const reset = React.useCallback(() => {
    try {
      window.localStorage.removeItem(keyOf(instanceId));
    } catch {
      /* ignore */
    }
    if (relockTimer.current != null) window.clearTimeout(relockTimer.current);
    vkRef.current = null;
    setEntries([]);
    setError(null);
    setStatus("setup");
  }, [instanceId]);

  return {
    ready,
    status,
    entries,
    error,
    busy,
    setup,
    unlock,
    lock: doLock,
    add,
    update,
    remove,
    changePassword,
    reset,
    // Absolute relock: activity must not postpone it, so touch is a no-op.
    touch: () => {},
  };
}

export default useVault;

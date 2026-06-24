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
 *  Auto-relocks after `lockAfterMin` of inactivity (clears key + entries).
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
  /** Rearm the inactivity relock timer (call on user interaction). */
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
      armRelock();
      const next = [{ id: newCredentialId(), ...entry }, ...entries];
      await persist(next);
    },
    [entries, persist, armRelock],
  );

  const update = React.useCallback(
    async (id: string, patch: Partial<Omit<Credential, "id">>) => {
      armRelock();
      const next = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      await persist(next);
    },
    [entries, persist, armRelock],
  );

  const remove = React.useCallback(
    async (id: string) => {
      armRelock();
      await persist(entries.filter((e) => e.id !== id));
    },
    [entries, persist, armRelock],
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
        armRelock();
      } finally {
        setBusy(false);
      }
    },
    [entries, instanceId, armRelock],
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
    touch: armRelock,
  };
}

export default useVault;

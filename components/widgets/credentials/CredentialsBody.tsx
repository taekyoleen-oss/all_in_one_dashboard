"use client";

/**
 * CredentialsBody — shared UI for the 비밀번호 금고 widget (Compact + Expanded).
 *
 *  Renders one of three states from useVault: 최초 설정(setup) · 잠김(locked) ·
 *  열림(unlocked). When unlocked, lists logins with per-field copy + a password
 *  reveal toggle, and an add/edit form. Passwords are shown masked until you tap
 *  the eye; nothing here is ever written to `config` (the vault is encrypted in
 *  localStorage — see types.ts). The `size` prop only tunes density.
 */

import * as React from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useVault } from "./useVault";
import type { Credential, CredentialsConfig } from "./types";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CredentialsBody({
  config,
  instanceId,
  size = "compact",
}: {
  config: CredentialsConfig;
  instanceId: string;
  size?: "compact" | "expanded";
}) {
  const vault = useVault(instanceId, config.lockAfterMin);

  // Until the client-side localStorage read has run, render a neutral placeholder
  // so SSR and the first client render match (avoids a hydration mismatch).
  if (!vault.ready) {
    return <div className="h-full" aria-hidden />;
  }

  if (vault.status === "setup") {
    return <SetupScreen vault={vault} size={size} />;
  }
  if (vault.status === "locked") {
    return <LockScreen vault={vault} size={size} />;
  }
  return <UnlockedView vault={vault} size={size} />;
}

/* ------------------------------- setup screen ----------------------------- */

function SetupScreen({
  vault,
  size,
}: {
  vault: ReturnType<typeof useVault>;
  size: "compact" | "expanded";
}) {
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [mismatch, setMismatch] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    void vault.setup(pw);
  };

  return (
    <form
      onSubmit={submit}
      data-pb-no-drag=""
      className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center"
    >
      <Shield
        size={size === "expanded" ? 30 : 24}
        aria-hidden
        className="text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">
        비밀번호 금고를 사용하려면 마스터 비밀번호를 설정하세요.
      </p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password"
        placeholder="마스터 비밀번호 (4자 이상)"
        className="w-full max-w-56 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <input
        type="password"
        value={pw2}
        onChange={(e) => {
          setPw2(e.target.value);
          setMismatch(false);
        }}
        autoComplete="new-password"
        placeholder="비밀번호 확인"
        className="w-full max-w-56 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {mismatch ? (
        <p className="text-[11px] text-destructive">비밀번호가 일치하지 않습니다.</p>
      ) : null}
      {vault.error ? (
        <p className="text-[11px] text-destructive">{vault.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={vault.busy}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {vault.busy ? "설정 중…" : "금고 만들기"}
      </button>
      <p className="max-w-60 text-[10px] leading-snug text-muted-foreground">
        ⚠ 마스터 비밀번호는 복구할 수 없습니다. 잊으면 저장한 정보를 열 수 없어요.
        데이터는 이 기기에만 암호화되어 저장됩니다.
      </p>
    </form>
  );
}

/* -------------------------------- lock screen ----------------------------- */

function LockScreen({
  vault,
  size,
}: {
  vault: ReturnType<typeof useVault>;
  size: "compact" | "expanded";
}) {
  const [pw, setPw] = React.useState("");
  const [confirmReset, setConfirmReset] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void vault.unlock(pw).then((ok) => {
      if (ok) setPw("");
    });
  };

  return (
    <form
      onSubmit={submit}
      data-pb-no-drag=""
      className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center"
    >
      <Lock
        size={size === "expanded" ? 28 : 22}
        aria-hidden
        className="text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">
        잠긴 금고입니다. 마스터 비밀번호를 입력하세요.
      </p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoComplete="off"
        placeholder="마스터 비밀번호"
        className="w-full max-w-56 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {vault.error ? (
        <p className="text-[11px] text-destructive">{vault.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={vault.busy}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {vault.busy ? "확인 중…" : "잠금 해제"}
      </button>

      {confirmReset ? (
        <div className="mt-1 flex flex-col items-center gap-1">
          <p className="max-w-60 text-[10px] leading-snug text-destructive">
            초기화하면 이 기기에 저장된 모든 로그인이 영구 삭제됩니다. 계속할까요?
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => vault.reset()}
              className="rounded-md border border-destructive px-2 py-1 text-[11px] text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="mt-0.5 text-[10px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          비밀번호를 잊으셨나요? 금고 초기화
        </button>
      )}
    </form>
  );
}

/* ------------------------------ unlocked view ----------------------------- */

const EMPTY_DRAFT: Omit<Credential, "id"> = {
  site: "",
  url: "",
  username: "",
  password: "",
  note: "",
};

function UnlockedView({
  vault,
  size,
}: {
  vault: ReturnType<typeof useVault>;
  size: "compact" | "expanded";
}) {
  const [adding, setAdding] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);

  const startAdd = () => {
    setEditId(null);
    setAdding((v) => !v);
  };

  return (
    <div
      className="flex h-full flex-col gap-1.5"
      data-pb-no-drag=""
      onPointerDownCapture={() => vault.touch()}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {vault.entries.length}개 저장됨
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={13} aria-hidden /> 추가
          </button>
          <button
            type="button"
            onClick={() => vault.lock()}
            title="잠그기"
            aria-label="잠그기"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock size={13} aria-hidden /> 잠금
          </button>
        </div>
      </div>

      {adding ? (
        <EntryForm
          initial={EMPTY_DRAFT}
          onCancel={() => setAdding(false)}
          onSubmit={async (draft) => {
            await vault.add(draft);
            setAdding(false);
          }}
          busy={vault.busy}
        />
      ) : null}

      {vault.error ? (
        <p className="shrink-0 text-[11px] text-destructive">{vault.error}</p>
      ) : null}

      {vault.entries.length === 0 && !adding ? (
        <p className="flex-1 px-1 py-2 text-sm text-muted-foreground">
          저장된 로그인이 없습니다. ‘추가’로 사이트·아이디·비밀번호를 등록하세요.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-scroll">
          {vault.entries.map((entry) =>
            editId === entry.id ? (
              <li key={entry.id}>
                <EntryForm
                  initial={entry}
                  onCancel={() => setEditId(null)}
                  onSubmit={async (draft) => {
                    await vault.update(entry.id, draft);
                    setEditId(null);
                  }}
                  busy={vault.busy}
                />
              </li>
            ) : (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  size={size}
                  onEdit={() => {
                    setAdding(false);
                    setEditId(entry.id);
                  }}
                  onDelete={() => void vault.remove(entry.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {size === "expanded" ? <MasterPasswordChange vault={vault} /> : null}
    </div>
  );
}

/* -------------------------------- entry row ------------------------------- */

function EntryRow({
  entry,
  size,
  onEdit,
  onDelete,
}: {
  entry: Credential;
  size: "compact" | "expanded";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [reveal, setReveal] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);

  const href = entry.url
    ? /^https?:\/\//i.test(entry.url)
      ? entry.url
      : `https://${entry.url}`
    : null;

  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {entry.site || entry.url || "(이름 없음)"}
          </p>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[11px] text-[#0891B2] hover:underline"
            >
              {entry.url}
            </a>
          ) : entry.url ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {entry.url}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn label="수정" onClick={onEdit}>
            <Pencil size={13} aria-hidden />
          </IconBtn>
          {confirmDel ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-destructive px-1.5 py-1 text-[11px] text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              삭제?
            </button>
          ) : (
            <IconBtn label="삭제" onClick={() => setConfirmDel(true)}>
              <Trash2 size={13} aria-hidden />
            </IconBtn>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-col gap-1">
        {entry.username ? (
          <FieldRow label="아이디" value={entry.username} mono />
        ) : null}
        {entry.password ? (
          <div className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
              비밀번호
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {reveal ? entry.password : "•".repeat(Math.min(entry.password.length, 12))}
            </span>
            <IconBtn
              label={reveal ? "비밀번호 숨기기" : "비밀번호 보기"}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff size={13} aria-hidden /> : <Eye size={13} aria-hidden />}
            </IconBtn>
            <CopyBtn value={entry.password} />
          </div>
        ) : null}
        {entry.note ? (
          <p
            className={[
              "whitespace-pre-wrap break-words text-[11px] text-muted-foreground",
              size === "compact" ? "line-clamp-3" : "",
            ].join(" ")}
          >
            <span className="text-muted-foreground/70">비고: </span>
            {entry.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-10 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <span
        className={[
          "min-w-0 flex-1 truncate text-xs text-foreground",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </span>
      <CopyBtn value={value} />
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <IconBtn
      label={done ? "복사됨" : "복사"}
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        }
      }}
    >
      {done ? (
        <span className="text-[10px] text-emerald-500">✓</span>
      ) : (
        <Copy size={13} aria-hidden />
      )}
    </IconBtn>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

/* -------------------------------- entry form ------------------------------ */

function EntryForm({
  initial,
  onCancel,
  onSubmit,
  busy,
}: {
  initial: Omit<Credential, "id">;
  onCancel: () => void;
  onSubmit: (draft: Omit<Credential, "id">) => void | Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = React.useState<Omit<Credential, "id">>(initial);
  const [showPw, setShowPw] = React.useState(false);

  const set = (k: keyof Omit<Credential, "id">) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.site.trim() && !draft.url.trim() && !draft.username.trim()) {
      return; // need at least something identifying
    }
    void onSubmit({
      site: draft.site.trim(),
      url: draft.url.trim(),
      username: draft.username.trim(),
      password: draft.password,
      note: draft.note.trim(),
    });
  };

  const inputCls =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form
      onSubmit={submit}
      className="flex shrink-0 flex-col gap-1.5 rounded-md border border-primary/40 bg-primary/5 p-2"
    >
      <input
        value={draft.site}
        onChange={(e) => set("site")(e.target.value)}
        placeholder="사이트명 (예: GitHub)"
        className={inputCls}
      />
      <input
        value={draft.url}
        onChange={(e) => set("url")(e.target.value)}
        placeholder="웹사이트 주소 (예: github.com)"
        inputMode="url"
        className={inputCls}
      />
      <input
        value={draft.username}
        onChange={(e) => set("username")(e.target.value)}
        placeholder="아이디"
        autoComplete="off"
        className={inputCls}
      />
      <div className="flex items-center gap-1.5">
        <input
          value={draft.password}
          onChange={(e) => set("password")(e.target.value)}
          placeholder="비밀번호"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          title={showPw ? "숨기기" : "보기"}
          aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 보기"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showPw ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
      </div>
      <textarea
        value={draft.note}
        onChange={(e) => set("note")(e.target.value)}
        placeholder="비고 — 이 사이트/계정 설명"
        rows={2}
        className={`${inputCls} resize-none`}
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={13} aria-hidden /> 취소
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </form>
  );
}

/* -------------------------- master password change ------------------------ */

function MasterPasswordChange({ vault }: { vault: ReturnType<typeof useVault> }) {
  const [open, setOpen] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [done, setDone] = React.useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex shrink-0 items-center gap-1 self-start text-[11px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KeyRound size={12} aria-hidden /> 마스터 비밀번호 변경
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void vault.changePassword(pw).then(() => {
          if (pw.trim().length >= 4) {
            setDone(true);
            setPw("");
            setOpen(false);
            window.setTimeout(() => setDone(false), 1500);
          }
        });
      }}
      className="mt-1 flex shrink-0 items-center gap-1.5 rounded-md border border-border p-1.5"
    >
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="새 마스터 비밀번호"
        autoComplete="new-password"
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        disabled={vault.busy}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        변경
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-border px-2 py-1 text-xs text-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        취소
      </button>
      {done ? <span className="text-[11px] text-emerald-500">✓</span> : null}
    </form>
  );
}

export default CredentialsBody;

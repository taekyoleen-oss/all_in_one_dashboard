-- 클립보드 즐겨찾기(요구): 각 복사 항목에 즐겨찾기 토글 — 즐겨찾기 항목은 목록 맨 위
-- 고정 + '오늘 복사' 강조와 같은 형태(2단계 큰 글씨·bold)로, 색만 파란색으로 표시한다.
--
--  fav는 기록 자체처럼 기기 간 동기화되어야 하므로 pb_clipboard 컬럼으로 저장한다
--  (RLS는 테이블 정책(pb_clipboard_all, 소유자 CRUD)이 그대로 적용 — 정책 변경 없음).
--  멱등: add column if not exists.

alter table pb_clipboard
  add column if not exists fav boolean not null default false;

-- 작업 일자(요구): 추가·수정 시 일자를 입력하고 목록에 함께 표시한다.
-- 시각 없는 날짜 개념이라 date 타입(RLS는 기존 테이블 정책 그대로).

alter table pb_tasks
  add column if not exists due_on date;

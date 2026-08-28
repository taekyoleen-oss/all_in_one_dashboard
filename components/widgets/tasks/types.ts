/**
 * 작업(tasks) 위젯 config — 데이터(작업 행)는 pb_tasks 테이블(기기 간 동기화),
 * config에는 모바일 연동 지정 플래그만 둔다.
 */

export interface TasksConfig {
  /** 이 인스턴스의 목록을 안드로이드 홈 화면 위젯에 표시할지. */
  mobileSync?: boolean;
  /** 켠 시각(ms) — 여러 인스턴스가 켜져 있으면 서버가 최신을 채택(widgetCore.pickTasksInstance). */
  mobileSyncAt?: number;
}

export const DEFAULT_TASKS_CONFIG: TasksConfig = {};

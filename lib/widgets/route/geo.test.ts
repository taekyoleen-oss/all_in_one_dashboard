/**
 * 길찾기 지오 계산 회귀 테스트 — 이 수학이 틀리면 크래시가 아니라 "엉뚱한 방향 안내"와
 * "도로를 벗어난 경로선"으로 나타난다. 실행: node --test lib/widgets/route/geo.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  haversine,
  cumulativeDistances,
  pathLength,
  resamplePath,
  resampleDistances,
  projectOntoPath,
  project,
  toPixel,
  fromPixel,
  unproject,
  boundsOf,
  fitView,
  formatDistance,
  formatDuration,
  MAX_ZOOM,
  type LonLat,
} from "./geo.ts";

/** 이태원역 → N서울타워 축약 경로(실제 TMAP 응답에서 발췌한 형태). */
const SEOUL: LonLat[] = [
  [126.9946, 37.5345],
  [126.9950, 37.5350],
  [126.9952, 37.5360],
  [126.9940, 37.5400],
  [126.9882, 37.5512],
];

test("haversine — 알려진 거리와 일치(서울시청→강남역)", () => {
  const d = haversine([126.978, 37.5665], [127.0276, 37.4979]);
  // 독립 검산(등거리 원통 근사): Δlat 0.0686°×111,132=7,624m · Δlon 0.0496°×111,320×cos(37.53°)=4,380m → √(7624²+4380²)≈8,792m
  assert.ok(Math.abs(d - 8792) < 30, `${d}m`);
});

test("haversine — 같은 점은 0, 대칭이다", () => {
  assert.equal(haversine([126.9, 37.5], [126.9, 37.5]), 0);
  const a = haversine([126.9, 37.5], [127.0, 37.6]);
  const b = haversine([127.0, 37.6], [126.9, 37.5]);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("누적거리 — 길이가 같고, 0에서 시작하며, 단조 증가한다", () => {
  const cum = cumulativeDistances(SEOUL);
  assert.equal(cum.length, SEOUL.length);
  assert.equal(cum[0], 0);
  for (let i = 1; i < cum.length; i++) assert.ok(cum[i] > cum[i - 1]);
  assert.ok(Math.abs(cum.at(-1)! - pathLength(SEOUL)) < 1e-9);
});

test("누적거리 — 빈 경로/1점 경로에서 터지지 않는다", () => {
  assert.deepEqual(cumulativeDistances([]), [0]);
  assert.equal(pathLength([]), 0);
  assert.equal(pathLength([[126.9, 37.5]]), 0);
});

test("리샘플 — 요청한 개수, 양 끝 보존, 간격이 균일하다", () => {
  const n = 50;
  const rs = resamplePath(SEOUL, n);
  assert.equal(rs.length, n);
  assert.deepEqual(rs[0], SEOUL[0]);
  assert.ok(Math.abs(rs.at(-1)![0] - SEOUL.at(-1)![0]) < 1e-9);
  assert.ok(Math.abs(rs.at(-1)![1] - SEOUL.at(-1)![1]) < 1e-9);

  const gaps: number[] = [];
  for (let i = 1; i < rs.length; i++) gaps.push(haversine(rs[i - 1], rs[i]));
  const spread = (Math.max(...gaps) - Math.min(...gaps)) / Math.max(...gaps);
  assert.ok(spread < 0.02, `간격 편차 ${(spread * 100).toFixed(2)}%`);
});

test("리샘플 — 총 길이를 보존한다(고도 그래프 X축이 왜곡되지 않음)", () => {
  const before = pathLength(SEOUL);
  const after = pathLength(resamplePath(SEOUL, 100));
  assert.ok(Math.abs(after - before) / before < 0.001, `${before} → ${after}`);
});

test("리샘플 — 퇴화 입력(빈 경로·n=1·모든 점이 같음)", () => {
  assert.deepEqual(resamplePath([], 10), []);
  assert.deepEqual(resamplePath(SEOUL, 1), [SEOUL[0]]);
  assert.deepEqual(resamplePath(SEOUL, 0), []);
  const same: LonLat[] = [[126.9, 37.5], [126.9, 37.5]];
  assert.deepEqual(resamplePath(same, 5), [[126.9, 37.5]]);
});

test("리샘플 거리축 — 0에서 시작해 원본 총거리에서 끝난다", () => {
  // 회귀: 리샘플된 선을 다시 재면 굽이를 가로질러 짧아진다(실측 2,967m → 2,863m).
  // 거리축은 반드시 원본 경로 기준이어야 고도 그래프가 도착점까지 닿는다.
  const total = pathLength(SEOUL);
  const d = resampleDistances(SEOUL, 100);
  assert.equal(d.length, 100);
  assert.equal(d[0], 0);
  assert.ok(Math.abs(d.at(-1)! - total) < 1e-6, `${d.at(-1)} vs ${total}`);
  // 리샘플된 폴리라인을 다시 잰 값보다 크다(= 코너 손실을 피했다는 증거)
  assert.ok(d.at(-1)! > pathLength(resamplePath(SEOUL, 100)) - 1e-6);
});

test("리샘플 거리축 — 길이가 항상 resamplePath와 일치한다(퇴화 입력 포함)", () => {
  const cases: Array<[LonLat[], number]> = [
    [SEOUL, 100], [SEOUL, 1], [SEOUL, 0], [[], 10],
    [[[126.9, 37.5]], 5],
    [[[126.9, 37.5], [126.9, 37.5]], 5],
  ];
  for (const [p, n] of cases) {
    assert.equal(resampleDistances(p, n).length, resamplePath(p, n).length, `n=${n}, path=${p.length}`);
  }
});

test("리샘플 거리축 — 등간격이며 단조 증가", () => {
  const d = resampleDistances(SEOUL, 20);
  const step = d[1] - d[0];
  for (let i = 1; i < d.length; i++) {
    assert.ok(Math.abs(d[i] - d[i - 1] - step) < 1e-9);
  }
});

test("경로 투영 — 경로 위의 점은 offset≈0, 누적거리가 맞다", () => {
  const mid = SEOUL[2];
  const p = projectOntoPath(SEOUL, mid);
  assert.ok(p.offset < 1, `offset ${p.offset}m`);
  const cum = cumulativeDistances(SEOUL);
  assert.ok(Math.abs(p.distanceAlong - cum[2]) < 1, `${p.distanceAlong} vs ${cum[2]}`);
});

test("경로 투영 — 구간 중간의 점은 누적거리도 중간이다", () => {
  const a = SEOUL[0], b = SEOUL[1];
  const mid: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p = projectOntoPath(SEOUL, mid);
  const expected = haversine(a, b) / 2;
  assert.ok(p.offset < 1);
  assert.ok(Math.abs(p.distanceAlong - expected) < 2, `${p.distanceAlong} vs ${expected}`);
});

test("경로 투영 — 벗어난 점은 offset이 실제 이탈 거리와 맞는다(이탈 판정의 근거)", () => {
  // 출발점에서 정확히 동쪽으로 약 100m 떨어진 지점
  const off: LonLat = [SEOUL[0][0] + 100 / (111_320 * Math.cos((37.5345 * Math.PI) / 180)), SEOUL[0][1]];
  const p = projectOntoPath(SEOUL, off);
  assert.ok(p.offset > 50 && p.offset < 150, `offset ${p.offset}m`);
});

test("경로 투영 — 퇴화 입력에서 터지지 않는다", () => {
  const single: LonLat[] = [[126.9, 37.5]];
  assert.equal(projectOntoPath(single, [126.91, 37.5]).distanceAlong, 0);
  assert.equal(projectOntoPath([], [126.9, 37.5]).offset, 0);
  // 길이 0인 구간(중복 점)이 있어도 0으로 나누지 않는다
  const dup: LonLat[] = [[126.9, 37.5], [126.9, 37.5], [126.91, 37.51]];
  assert.ok(Number.isFinite(projectOntoPath(dup, [126.905, 37.505]).distanceAlong));
});

test("투영 — TMAP은 512px 타일(표준 Web Mercator의 2배)이다", () => {
  // 실측 확정값. 256으로 되돌아가면 경로선이 지도와 2배 어긋난다.
  const z = 15;
  const a = project(126.0, 37.5, z);
  const b = project(127.0, 37.5, z);
  const pxPerDegree = b.x - a.x;
  assert.ok(Math.abs(pxPerDegree - (512 * 2 ** z) / 360) < 1e-6, `${pxPerDegree}`);
});

test("투영 — 경도 증가는 x 증가, 위도 증가는 y 감소(북쪽이 위)", () => {
  const base = project(126.99, 37.54, 15);
  assert.ok(project(127.0, 37.54, 15).x > base.x);
  assert.ok(project(126.99, 37.55, 15).y < base.y);
});

test("픽셀 변환 — 중심 좌표는 이미지 정중앙", () => {
  const view = { center: [126.9924, 37.543] as LonLat, zoom: 15 };
  const [x, y] = toPixel(view.center, view, 512, 512);
  assert.ok(Math.abs(x - 256) < 1e-6);
  assert.ok(Math.abs(y - 256) < 1e-6);
});

test("역투영 — project를 정확히 되돌린다", () => {
  for (const z of [12, 15, 19]) {
    for (const [lon, lat] of SEOUL) {
      const p = project(lon, lat, z);
      const [lon2, lat2] = unproject(p.x, p.y, z);
      assert.ok(Math.abs(lon2 - lon) < 1e-9, `lon ${lon2} vs ${lon} @z${z}`);
      assert.ok(Math.abs(lat2 - lat) < 1e-9, `lat ${lat2} vs ${lat} @z${z}`);
    }
  }
});

test("픽셀 역변환 — toPixel을 정확히 되돌린다(지도 클릭 → 좌표)", () => {
  const view = { center: [126.9924, 37.543] as LonLat, zoom: 16 };
  for (const pt of SEOUL) {
    const [x, y] = toPixel(pt, view, 800, 600);
    const [lon, lat] = fromPixel(x, y, view, 800, 600);
    assert.ok(Math.abs(lon - pt[0]) < 1e-9, `lon ${lon} vs ${pt[0]}`);
    assert.ok(Math.abs(lat - pt[1]) < 1e-9, `lat ${lat} vs ${pt[1]}`);
  }
});

test("픽셀 역변환 — 정중앙 클릭은 지도 중심", () => {
  const view = { center: [126.9924, 37.543] as LonLat, zoom: 15 };
  const [lon, lat] = fromPixel(256, 256, view, 512, 512);
  assert.ok(Math.abs(lon - 126.9924) < 1e-9);
  assert.ok(Math.abs(lat - 37.543) < 1e-9);
});

test("픽셀 역변환 — 오른쪽·아래를 누르면 동쪽·남쪽이다", () => {
  const view = { center: [126.9924, 37.543] as LonLat, zoom: 15 };
  const [eastLon] = fromPixel(400, 256, view, 512, 512);
  const [, southLat] = fromPixel(256, 400, view, 512, 512);
  assert.ok(eastLon > 126.9924, "오른쪽 = 동쪽");
  assert.ok(southLat < 37.543, "아래 = 남쪽");
});

test("bbox — 경로 전체를 감싼다", () => {
  const b = boundsOf(SEOUL)!;
  assert.equal(b.west, 126.9882);
  assert.equal(b.east, 126.9952);
  assert.equal(b.south, 37.5345);
  assert.equal(b.north, 37.5512);
  assert.equal(boundsOf([]), null);
});

test("fitView — 경로 전체가 여백 안에 들어온다", () => {
  const b = boundsOf(SEOUL)!;
  const size = 512, pad = 24;
  const view = fitView(b, size, size, pad);
  for (const pt of SEOUL) {
    const [x, y] = toPixel(pt, view, size, size);
    assert.ok(x >= pad - 1 && x <= size - pad + 1, `x=${x}`);
    assert.ok(y >= pad - 1 && y <= size - pad + 1, `y=${y}`);
  }
});

test("fitView — 한 단계 더 확대하면 넘친다(가장 큰 줌을 골랐다는 증거)", () => {
  const b = boundsOf(SEOUL)!;
  const size = 512, pad = 24;
  const view = fitView(b, size, size, pad);
  const tighter = { center: view.center, zoom: view.zoom + 1 };
  const overflow = SEOUL.some((pt) => {
    const [x, y] = toPixel(pt, tighter, size, size);
    return x < pad || x > size - pad || y < pad || y > size - pad;
  });
  assert.ok(overflow, `zoom ${view.zoom + 1}에서도 들어가면 한 단계 손해다`);
});

test("fitView — 한 점만 있어도 주변이 보이는 배율을 고른다(미리보기)", () => {
  // 도착지만 정한 상태의 미리보기. 예전엔 범위가 0이라 최대 줌으로 확대돼
  // 주변이 아무것도 안 보였다.
  const pt = { west: 126.99, south: 37.54, east: 126.99, north: 37.54 };
  const view = fitView(pt, 512, 512);
  assert.ok(view.zoom < MAX_ZOOM, `zoom ${view.zoom}`);
  assert.deepEqual(view.center, [126.99, 37.54]);
  // 중심에서 약 200m 떨어진 점이 화면 안에 들어와야 한다
  const off: LonLat = [126.99 + 0.002, 37.54];
  const [x, y] = toPixel(off, view, 512, 512);
  assert.ok(x > 0 && x < 512 && y > 0 && y < 512, `(${x}, ${y})`);
});

test("fitView — 넓은 범위는 최소 범위에 영향받지 않는다", () => {
  const b = boundsOf(SEOUL)!;
  const view = fitView(b, 512, 512);
  // 실제 경로(약 2km)는 최소 범위(400m)보다 훨씬 크므로 종전과 같아야 한다
  for (const pt of SEOUL) {
    const [x, y] = toPixel(pt, view, 512, 512);
    assert.ok(x >= 23 && x <= 489 && y >= 23 && y <= 489, `(${x}, ${y})`);
  }
});

test("fitView — 줌은 티맵 지원 범위(6~19) 안이다", () => {
  const world = { west: -180, south: -85, east: 180, north: 85 };
  assert.ok(fitView(world, 512, 512).zoom >= 6);
  const tiny = { west: 126.99, south: 37.54, east: 126.9901, north: 37.5401 };
  assert.ok(fitView(tiny, 512, 512).zoom <= 19);
});

test("표시 — 거리·시간 형식", () => {
  assert.equal(formatDistance(0), "0m");
  assert.equal(formatDistance(234), "230m");
  assert.equal(formatDistance(999), "1000m");
  assert.equal(formatDistance(1000), "1.0km");
  assert.equal(formatDistance(2967), "3.0km");
  assert.equal(formatDistance(-1), "");
  assert.equal(formatDuration(0), "0분");
  assert.equal(formatDuration(1260), "21분");
  assert.equal(formatDuration(3600), "1시간");
  assert.equal(formatDuration(3900), "1시간 5분");
});

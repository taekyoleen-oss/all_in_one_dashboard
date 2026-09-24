/**
 * 환율 환산 불변식 — 웹 위젯과 폰 브리지가 같은 숫자를 보여야 한다.
 * 실행: node --test lib/widgets/fx/rows.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { fxRows } from "../../../components/widgets/fx/rows.ts";

const near = (a: number | undefined, b: number, eps = 1e-6) =>
  assert.ok(a !== undefined && Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("1원당 외화를 원화 값으로 뒤집는다 — 엔만 100 단위", () => {
  // 1 USD = 1,250원 → rates.USD = 1/1250, 100 JPY = 900원 → rates.JPY = 100/900 per 1 KRW
  const rows = fxRows(["USD", "JPY"], { USD: 1 / 1250, JPY: 100 / 900 });
  assert.deepEqual(rows.map((r) => r.code), ["USD", "JPY"]);
  near(rows[0].krw, 1250);
  assert.equal(rows[0].unit, 1);
  near(rows[1].krw, 900);
  assert.equal(rows[1].unit, 100); // 엔은 100 단위가 관례
});

test("전일 대비는 부호를 뒤집는다 — '1원당 달러'가 오르면 '1달러당 원'은 내린다", () => {
  const [usd] = fxRows(["USD"], { USD: 1 / 1250 }, { USD: 1 });
  near(usd.changePct, -1);
  // 어제 원화값 = 1250 / 0.99 ≈ 1262.63 → 오늘이 12.63원 낮다.
  near(usd.changeAbs!, 1250 - 1250 / 0.99, 1e-6);
  assert.ok(usd.changeAbs! < 0);
});

test("전일 대비가 없으면 값도 없다(0으로 꾸미지 않는다)", () => {
  const [usd] = fxRows(["USD"], { USD: 1 / 1250 });
  assert.equal(usd.changePct, undefined);
  assert.equal(usd.changeAbs, undefined);
});

test("환율이 없거나 0인 코드는 행을 만들지 않는다(0 나눗셈 차단)", () => {
  assert.deepEqual(fxRows(["USD", "EUR", "XXX"], { USD: 0, EUR: 1 / 1400 }).map((r) => r.code), [
    "EUR",
  ]);
});

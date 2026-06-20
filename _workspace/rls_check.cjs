// Phase 1 RLS/불변식 게이트 (로그인 불필요, 카탈로그 기반 증명)
// 비밀번호는 process.env.SUPABASE_DB_PASSWORD 로만 받는다(파일 미저장).
// 행동형 격리/위반 insert 테스트는 첫 로그인 후 rls-verify의 isolation-queries.sql로 수행.
const { Client } = require('pg');
const fs = require('fs');

const PB = ['pb_user_settings', 'pb_dashboards', 'pb_widgets', 'pb_cards', 'pb_card_transactions'];

const client = new Client({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.nsedndrdykeujribqyqx',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  const rls = (await client.query(
    `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'pb\\_%' order by 1`
  )).rows;

  const pols = (await client.query(
    `select tablename, policyname, cmd, (qual is not null) as has_using,
            (with_check is not null) as has_check, coalesce(with_check,'') as wc
     from pg_policies where schemaname='public' and tablename like 'pb\\_%' order by 1,2`
  )).rows;

  const idx = (await client.query(
    `select tablename, indexname, indexdef from pg_indexes
     where schemaname='public' and tablename = any($1) order by 1,2`, [PB]
  )).rows;

  const cons = (await client.query(
    `select conrelid::regclass::text as tbl, contype, pg_get_constraintdef(oid) as def
     from pg_constraint where conrelid = any($1::regclass[]) order by 1`,
    [PB.map(t => 'public.' + t)]
  )).rows;

  const bucket = (await client.query(`select id, public from storage.buckets where id='pb-images'`)).rows;
  const spol = (await client.query(
    `select policyname, cmd, (with_check is not null) as has_check
     from pg_policies where schemaname='storage' and tablename='objects' and policyname='pb_images_rw'`
  )).rows;

  await client.end();

  // ---- assertions ----
  const rlsOn = t => (rls.find(r => r.tablename === t) || {}).rowsecurity === true;
  const hasCheck = t => pols.some(p => p.tablename === t && p.has_check);
  const childExists = t => pols.some(p => p.tablename === t && /exists/i.test(p.wc) && /auth\.uid\(\)/i.test(p.wc));
  const idxHit = (t, re) => idx.some(i => i.tablename === t && re.test(i.indexdef));
  const consHit = (t, re) => cons.some(c => c.tbl.replace('public.', '') === t && re.test(c.def));

  const checks = {
    'RLS on (5 테이블)': PB.every(rlsOn),
    '각 테이블 with_check 정책': PB.every(hasCheck),
    'pb_widgets 부모검증(exists+auth.uid)': childExists('pb_widgets'),
    'pb_card_transactions 부모검증(exists+auth.uid)': childExists('pb_card_transactions'),
    'single-default 부분유니크 인덱스': idxHit('pb_dashboards', /unique/i) && idxHit('pb_dashboards', /is_default/i),
    'raw_hash (user_id) 유니크': idx.some(i => i.tablename === 'pb_card_transactions' && /unique/i.test(i.indexdef) && /user_id/.test(i.indexdef) && /raw_hash/.test(i.indexdef)),
    'last4 체크 제약': consHit('pb_cards', /last4/i) && cons.some(c => c.tbl.includes('pb_cards') && c.contype === 'c'),
    'user_id → auth.users FK (전 테이블)': PB.every(t => cons.some(c => c.tbl.replace('public.', '') === t && c.contype === 'f' && /auth\.users/i.test(c.def))),
    'pb-images 버킷 비공개': bucket.length === 1 && bucket[0].public === false,
    'storage 경로 prefix 정책': spol.length === 1 && spol[0].has_check,
  };

  const lines = [];
  lines.push('# Phase 1 QA 리포트 — DB 보안/불변식 게이트');
  lines.push('');
  lines.push('생성: rls_check.cjs (카탈로그 기반, 로그인 불필요)\n');
  lines.push('## RLS 상태');
  rls.forEach(r => lines.push(`- ${r.tablename}: rowsecurity=${r.rowsecurity}`));
  lines.push('\n## 정책 (pb_*)');
  pols.forEach(p => lines.push(`- ${p.tablename}.${p.policyname} [${p.cmd}] using=${p.has_using} check=${p.has_check}`));
  lines.push('\n## 게이트 판정');
  let allPass = true;
  for (const [k, v] of Object.entries(checks)) { lines.push(`- ${v ? 'PASS' : 'FAIL'} — ${k}`); if (!v) allPass = false; }
  lines.push('');
  lines.push(`## 결과: ${allPass ? '✅ 전체 통과 (Phase 1 게이트 OPEN)' : '❌ 실패 항목 있음'}`);
  lines.push('');
  lines.push('> 행동형 격리/위반 insert 테스트(타 uid 차단, 불변식 위반 거부)는 첫 로그인 후 `.claude/skills/rls-verify/references/isolation-queries.sql`로 수행한다(auth.users에 실제 사용자 필요).');

  const report = lines.join('\n');
  fs.writeFileSync('_workspace/01_qa_report.md', report, 'utf8');
  console.log(report);
  console.log('\nVERDICT:', allPass ? 'PASS' : 'FAIL');
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(2); });

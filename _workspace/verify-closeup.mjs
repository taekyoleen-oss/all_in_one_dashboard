// 도로 정합 최종 확인 — 경로 중간부를 고배율로 확대해 폴리라인이 실제 도로 위에 있는지 본다.
import { readFileSync, writeFileSync } from "node:fs";
const env=Object.fromEntries(readFileSync(new URL("../.env.local",import.meta.url),"utf8")
  .split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#"))
  .map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));
const K=env.TMAP_APP_KEY, SIZE=512, TILE=512;   // ← 실측 확정된 타일 크기
const rad=d=>d*Math.PI/180;
const project=(lon,lat,z)=>{const s=Math.sin(rad(lat)),sc=TILE*2**z;
  return {x:(lon+180)/360*sc, y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*sc};};

const route=JSON.parse(readFileSync(new URL("./out/route.json",import.meta.url),"utf8"));
const lines=route.features.filter(f=>f.geometry?.type==="LineString")
  .sort((a,b)=>(a.properties?.index??0)-(b.properties?.index??0));
const path=[];
for(const f of lines) for(const c of f.geometry.coordinates){
  const l=path.at(-1); if(!l||l[0]!==c[0]||l[1]!==c[1]) path.push(c); }
const pts=route.features.filter(f=>f.geometry?.type==="Point");

// 경로의 여러 구간을 고배율로
const panels=[
  {label:"출발부(이태원역)", idx:0,   zoom:16},
  {label:"중간부",           idx:Math.floor(path.length*0.45), zoom:16},
  {label:"도착부(남산타워)", idx:path.length-1, zoom:16},
];
let html=`<!doctype html><meta charset="utf-8"><title>도로 정합 확대 검증</title>
<body style="margin:0;background:#111;color:#eee;font:12px system-ui">
<p style="padding:6px 10px;margin:0">빨간 선이 <b>도로 위</b>를 지나면 통과 (하늘=안내지점)</p>
<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 10px">`;
for(const p of panels){
  const [clon,clat]=path[p.idx];
  const c=project(clon,clat,p.zoom);
  const toPx=([lo,la])=>{const q=project(lo,la,p.zoom);return [q.x-c.x+SIZE/2, q.y-c.y+SIZE/2];};
  const poly=path.map(toPx).filter(([x,y])=>x>-200&&x<SIZE+200&&y>-200&&y<SIZE+200)
    .map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const guides=pts.map(g=>toPx(g.geometry.coordinates)).filter(([x,y])=>x>0&&x<SIZE&&y>0&&y<SIZE);
  const file=`close-${p.idx}.png`;
  const r=await fetch(`https://apis.openapi.sk.com/tmap/staticMap?${new URLSearchParams({
    version:"1",appKey:K,coordType:"WGS84GEO",longitude:String(clon),latitude:String(clat),
    zoom:String(p.zoom),width:String(SIZE),height:String(SIZE),format:"PNG"})}`);
  writeFileSync(new URL(`./out/${file}`,import.meta.url), Buffer.from(await r.arrayBuffer()));
  console.log(`${p.label}: HTTP ${r.status} @ ${clat.toFixed(5)},${clon.toFixed(5)} zoom ${p.zoom}`);
  html+=`<div style="position:relative;width:${SIZE}px;height:${SIZE}px">
    <img src="./${file}" width="${SIZE}" height="${SIZE}" style="position:absolute;inset:0">
    <svg width="${SIZE}" height="${SIZE}" style="position:absolute;inset:0">
      <polyline points="${poly}" fill="none" stroke="#ff2d55" stroke-width="3" stroke-opacity="0.8" stroke-linejoin="round"/>
      ${guides.map(([x,y])=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#00e5ff"/>`).join("")}
    </svg>
    <span style="position:absolute;left:4px;top:4px;background:#000a;padding:2px 6px">${p.label}</span>
  </div>`;
}
html+="</div></body>";
writeFileSync(new URL("./out/closeup.html",import.meta.url), html);
console.log("→ _workspace/out/closeup.html");

// 배율 정밀 측정 — 여러 Δ에 대한 시프트를 선형회귀해 양자화 오차를 평균낸다.
//   가설: 티맵 zoom z = 표준 zoom z+1 (배율 정확히 2.0)인가, 아니면 1.92인가?
import { readFileSync } from "node:fs";
import { decodePng } from "./png-diff.mjs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url),"utf8")
    .split(/\r?\n/).filter((l)=>l.includes("=")&&!l.startsWith("#"))
    .map((l)=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim()]));
const K=env.TMAP_APP_KEY, SIZE=512;
const get=async(lat,lon,zoom)=>{
  const r=await fetch(`https://apis.openapi.sk.com/tmap/staticMap?${new URLSearchParams({
    version:"1",appKey:K,coordType:"WGS84GEO",longitude:lon.toFixed(9),latitude:lat.toFixed(9),
    zoom:String(zoom),width:String(SIZE),height:String(SIZE),format:"PNG"})}`);
  if(!r.ok) throw new Error(`static ${r.status}`);
  const p=decodePng(Buffer.from(await r.arrayBuffer()));
  const g=new Uint8Array(p.w*p.h);
  for(let i=0;i<p.w*p.h;i++) g[i]=(p.rgb[i*3]*77+p.rgb[i*3+1]*150+p.rgb[i*3+2]*29)>>8;
  return {w:p.w,h:p.h,g};};
const sad=(A,B,sx,sy,step)=>{let s=0,n=0;
  for(let y=0;y<A.h;y+=step){const by=y-sy;if(by<0||by>=B.h)continue;
    for(let x=0;x<A.w;x+=step){const bx=x-sx;if(bx<0||bx>=B.w)continue;
      s+=Math.abs(A.g[y*A.w+x]-B.g[by*B.w+bx]);n++;}}
  return n<3000?Infinity:s/n;};
const findX=(A,B,lo,hi)=>{let b={s:Infinity,sx:0};
  for(let sx=lo;sx<=hi;sx++){const s=sad(A,B,sx,0,2);if(s<b.s)b={s,sx};}return b;};

const LAT=37.5430, LON=126.9924;
const stdPx=(z)=>(256*2**z)/360;

console.log("Δlon(도) → 실측 시프트(px)  [zoom 15]\n");
const Z=15, A=await get(LAT,LON,Z);
const pts=[];
for(const targetStd of [24,48,72,96,120]){         // 표준 기준 목표 px
  const dLon=targetStd/stdPx(Z);
  const B=await get(LAT,LON+dLon,Z);
  const b=findX(A,B,0,300);
  pts.push({dLon,px:b.sx});
  console.log(`   Δlon=${dLon.toExponential(4)}  표준예측 ${targetStd}px → 실측 ${b.sx}px  (배율 ${(b.sx/targetStd).toFixed(4)}, SAD ${b.s.toFixed(2)})`);
}
// 원점을 지나는 최소제곱 기울기
const slope=pts.reduce((a,p)=>a+p.dLon*p.px,0)/pts.reduce((a,p)=>a+p.dLon*p.dLon,0);
const factor=slope/stdPx(Z);
console.log(`\n회귀 기울기 = ${slope.toFixed(1)} px/도`);
console.log(`표준(256·2^z) = ${stdPx(Z).toFixed(1)} px/도`);
console.log(`배율 = ${factor.toFixed(5)}`);
console.log(`\n가설 검토:`);
console.log(`   정확히 2.0 (=zoom z+1, 타일 256) → 배율 2.00000, 오차 ${((factor-2)/2*100).toFixed(2)}%`);
console.log(`   타일 512 (=256·2^z·2)          → 동일`);
const impliedTile=256*factor;
console.log(`   실측이 함의하는 타일 크기 = 256 × ${factor.toFixed(4)} = ${impliedTile.toFixed(1)}px`);

(() => {
'use strict';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d',{alpha:false});
const start=document.getElementById('start');
const play=document.getElementById('play');
const posEl=document.getElementById('pos');
const err=document.getElementById('err');
const hint=document.getElementById('hint');
const keyEls={}; document.querySelectorAll('#keys [data-k]').forEach(el=>keyEls[el.dataset.k]=el);
let W=0,H=0,DPR=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,1.4);W=Math.max(640,innerWidth);H=Math.max(360,innerHeight);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize); resize();

const arena={rx:30.5,rz:21.2};
const obstacles=[];
const decorative=[];
function rect(x,z,w,d,h=2.4,type='stone',rot=0){obstacles.push({kind:'rect',x,z,w,d,h,type,rot})}
function circle(x,z,r,h=3.4,type='pillar'){obstacles.push({kind:'circle',x,z,r,h,type})}
function decoRect(x,z,w,d,h,type='stone',rot=0){decorative.push({kind:'rect',x,z,w,d,h,type,rot})}

// Outer broken oval wall, with four circulation gaps.
for(let i=0;i<34;i++){
  const a=i/34*Math.PI*2;
  const deg=((a*180/Math.PI)+360)%360;
  const gap=(deg<10||deg>350)||(deg>78&&deg<102)||(deg>168&&deg<192)||(deg>258&&deg<282);
  if(gap) continue;
  const x=Math.cos(a)*29.0,z=Math.sin(a)*19.8;
  rect(x,z,3.8,1.7,3.3,'outer',a+Math.PI/2);
}
// Inner ritual ring, deliberately broken to make fast lanes.
for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2;
  const deg=((a*180/Math.PI)+360)%360;
  const gap=(deg>340||deg<20)||(deg>72&&deg<108)||(deg>160&&deg<200)||(deg>252&&deg<288);
  if(gap) continue;
  rect(Math.cos(a)*13.5,Math.sin(a)*9.3,3.0,1.3,1.65,'ring',a+Math.PI/2);
}

// Central Göbekli Tepe T-pillars. Rectangular so they read as megaliths, not pipes.
function tPillar(x,z,rot=0){rect(x,z,1.7,1.25,5.6,'pillar',rot);const ox=Math.cos(rot+Math.PI/2)*0.0,oz=Math.sin(rot+Math.PI/2)*0.0;rect(x+ox,z+oz,3.2,.72,5.6,'cap',rot)}
tPillar(-2.35,0,Math.PI/2);tPillar(2.35,0,Math.PI/2);
for(const p of [[0,-6.0,0],[0,6.0,0],[-7.8,-3.2,.4],[-7.8,3.2,-.4],[7.8,-3.2,-.4],[7.8,3.2,.4]]) rect(p[0],p[1],1.35,1.05,4.1,'pillar',p[2]);

// Covers and archaeological blocks, kept symmetrical for first balance pass.
const covers=[[-22,-9,3.4,2.0,1.7],[-22,9,3.4,2.0,1.7],[-17,-14.8,3.8,1.8,1.45],[-17,14.8,3.8,1.8,1.45],[-10.5,-14,2.3,2.3,1.9],[-10.5,14,2.3,2.3,1.9]];
for(const c of covers){rect(...c,'cover',0);rect(-c[0],c[1],c[2],c[3],c[4],'cover',0)}
rect(-18,0,4.8,1.35,1.35,'low',0);rect(18,0,4.8,1.35,1.35,'low',0);
rect(0,-14.5,5.0,1.3,1.5,'low',0);rect(0,14.5,5.0,1.3,1.5,'low',0);
// a few low non-colliding fragments visually break up the floor
for(let i=0;i<18;i++){const a=i*2.399,r=7+(i%5)*3.6;decoRect(Math.cos(a)*r,Math.sin(a)*r*.67,1.1+(i%3)*.5,.65,0.28,'debris',a)}

let px=-24.8,pz=0,yaw=0,pitch=0,locked=false,last=performance.now();
let bob=0,recoil=0,muzzle=0;
const down={w:false,a:false,s:false,d:false,shift:false};
function setKey(k,v){if(k in down){down[k]=v;if(keyEls[k]) keyEls[k].classList.toggle('on',v)}}
function keyName(e){const k=(e.key||'').toLowerCase();if(k==='w'||e.code==='KeyW')return'w';if(k==='a'||e.code==='KeyA')return'a';if(k==='s'||e.code==='KeyS')return's';if(k==='d'||e.code==='KeyD')return'd';if(k==='shift'||e.code==='ShiftLeft'||e.code==='ShiftRight')return'shift';return''}
function onKey(e,v){const k=keyName(e);if(!k)return;setKey(k,v);e.preventDefault();e.stopPropagation()}
document.addEventListener('keydown',e=>onKey(e,true),true);
document.addEventListener('keyup',e=>onKey(e,false),true);
window.addEventListener('blur',()=>Object.keys(down).forEach(k=>setKey(k,false)));

function lockGame(){canvas.focus({preventScroll:true}); if(canvas.requestPointerLock){canvas.requestPointerLock()}else{locked=true;start.style.display='none'}}
play.addEventListener('click',()=>{err.textContent='';lockGame()});
canvas.addEventListener('click',()=>{if(!locked) lockGame()});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){start.style.display='none';canvas.focus({preventScroll:true})}else{start.style.display='flex';Object.keys(down).forEach(k=>setKey(k,false))}});
document.addEventListener('pointerlockerror',()=>{err.textContent='Fare kilidi tarayıcı tarafından engellendi. Sayfaya bir kez tıklayıp tekrar dene.'});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw+=e.movementX*0.00235;pitch+=e.movementY*0.00175;pitch=Math.max(-0.36,Math.min(0.36,pitch))});
document.addEventListener('mousedown',e=>{if(!locked||e.button!==0)return;muzzle=1;recoil=Math.min(.07,recoil+.035)});

function localRectPoint(x,z,r){const c=Math.cos(-r.rot),s=Math.sin(-r.rot),dx=x-r.x,dz=z-r.z;return{x:dx*c-dz*s,z:dx*s+dz*c}}
function insideArena(x,z,margin=.55){return (x*x)/((arena.rx-margin)**2)+(z*z)/((arena.rz-margin)**2)<1}
function hitsObstacle(x,z,margin=.45){for(const o of obstacles){if(o.kind==='circle'){const dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<(o.r+margin)**2)return true}else{const p=localRectPoint(x,z,o);if(Math.abs(p.x)<o.w/2+margin&&Math.abs(p.z)<o.d/2+margin)return true}}return false}
function valid(x,z){return insideArena(x,z)&&!hitsObstacle(x,z)}

function rayCircle(ox,oz,dx,dz,c){const rx=ox-c.x,rz=oz-c.z,b=rx*dx+rz*dz,cc=rx*rx+rz*rz-c.r*c.r,disc=b*b-cc;if(disc<0)return Infinity;const t=-b-Math.sqrt(disc);return t>0.03?t:Infinity}
function rayRect(ox,oz,dx,dz,r){const c=Math.cos(-r.rot),s=Math.sin(-r.rot);const rox=(ox-r.x)*c-(oz-r.z)*s,roz=(ox-r.x)*s+(oz-r.z)*c;const rdx=dx*c-dz*s,rdz=dx*s+dz*c;let tmin=-Infinity,tmax=Infinity;const minx=-r.w/2,maxx=r.w/2,minz=-r.d/2,maxz=r.d/2;
if(Math.abs(rdx)<1e-9){if(rox<minx||rox>maxx)return Infinity}else{let a=(minx-rox)/rdx,b=(maxx-rox)/rdx;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(Math.abs(rdz)<1e-9){if(roz<minz||roz>maxz)return Infinity}else{let a=(minz-roz)/rdz,b=(maxz-roz)/rdz;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(tmax<tmin||tmax<0)return Infinity;const t=tmin>0?tmin:tmax;return t>0.03?t:Infinity}
function rayEllipse(ox,oz,dx,dz){const A=dx*dx/(arena.rx*arena.rx)+dz*dz/(arena.rz*arena.rz),B=2*(ox*dx/(arena.rx*arena.rx)+oz*dz/(arena.rz*arena.rz)),C=ox*ox/(arena.rx*arena.rx)+oz*oz/(arena.rz*arena.rz)-1,D=B*B-4*A*C;if(D<0)return Infinity;const t2=(-B+Math.sqrt(D))/(2*A);return t2>0.03?t2:Infinity}
function cast(angle){const dx=Math.cos(angle),dz=Math.sin(angle);let t=rayEllipse(px,pz,dx,dz),best={t,h:3.0,type:'edge',hx:px+dx*t,hz:pz+dz*t};for(const o of obstacles){const q=o.kind==='circle'?rayCircle(px,pz,dx,dz,o):rayRect(px,pz,dx,dz,o);if(q<t){t=q;best={t:q,h:o.h,type:o.type,hx:px+dx*q,hz:pz+dz*q}}}return best}

const palette={outer:[132,108,77],edge:[88,67,47],ring:[151,123,86],pillar:[171,143,101],cap:[184,153,106],cover:[117,89,59],low:[133,103,70],debris:[111,86,58]};
function stoneColor(hit,dist,rayIndex){const base=palette[hit.type]||palette.outer;const mortar=((Math.floor((hit.hx+hit.hz)*1.65)+Math.floor(hit.hz*2.1))%7===0)?.77:1;const grain=.91+((Math.sin(hit.hx*9.2+hit.hz*5.7+rayIndex*.13)+1)*.045);const fog=Math.max(.30,1-dist/64);const light=.72+.28*Math.max(0,Math.sin(Math.atan2(hit.hz,hit.hx)+1.1));const mul=mortar*grain*fog*light;return `rgb(${base.map(v=>Math.max(0,Math.min(255,Math.round(v*mul)))).join(',')})`}

function drawSky(horizon){const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#5f8798');sky.addColorStop(.55,'#9fb1a8');sky.addColorStop(1,'#d9b679');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);
const sunX=W*.74,sunY=horizon*.30;const sg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,H*.22);sg.addColorStop(0,'rgba(255,238,190,.82)');sg.addColorStop(.12,'rgba(255,219,145,.28)');sg.addColorStop(1,'rgba(255,214,139,0)');ctx.fillStyle=sg;ctx.fillRect(0,0,W,horizon);
// distant limestone hills
ctx.save();ctx.globalAlpha=.38;ctx.fillStyle='#786c58';ctx.beginPath();ctx.moveTo(0,horizon);for(let x=0;x<=W;x+=W/14){const yy=horizon-18-Math.sin(x*.012+1.2)*15-Math.sin(x*.025)*7;ctx.lineTo(x,yy)}ctx.lineTo(W,horizon);ctx.closePath();ctx.fill();ctx.globalAlpha=.22;ctx.fillStyle='#5e574d';ctx.beginPath();ctx.moveTo(0,horizon);for(let x=0;x<=W;x+=W/18){const yy=horizon-8-Math.sin(x*.017+2.6)*11-Math.sin(x*.041)*5;ctx.lineTo(x,yy)}ctx.lineTo(W,horizon);ctx.closePath();ctx.fill();ctx.restore()}
function drawFloor(horizon){const g=ctx.createLinearGradient(0,horizon,0,H);g.addColorStop(0,'#a88252');g.addColorStop(.36,'#795936');g.addColorStop(1,'#302116');ctx.fillStyle=g;ctx.fillRect(0,horizon,W,H-horizon);
ctx.save();ctx.globalAlpha=.15;ctx.strokeStyle='#e8c98f';for(let y=horizon+16;y<H;y+=Math.max(14,(y-horizon)*.20)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.globalAlpha=.085;for(let x=-W;x<W*2;x+=66){ctx.beginPath();ctx.moveTo(W/2+(x-W/2)*.11,horizon);ctx.lineTo(x,H);ctx.stroke()}
// irregular paving fragments and soil patches
for(let i=0;i<34;i++){const yy=horizon+30+((i*73)%(Math.max(40,H-horizon-45)));const persp=(yy-horizon)/(H-horizon);const xx=(i*149)%Math.max(1,W);const rw=10+persp*32,rh=3+persp*10;ctx.fillStyle=i%3===0?'rgba(69,50,32,.16)':'rgba(224,190,133,.07)';ctx.beginPath();ctx.ellipse(xx,yy,rw,rh,(i%7)*.17,0,Math.PI*2);ctx.fill()}ctx.restore()}
function drawWeapon(){const cx=W*.57,cy=H*.94+Math.sin(bob*2)*3+recoil*H*.35;ctx.save();ctx.translate(cx,cy);ctx.rotate(-.04-recoil*.5);ctx.fillStyle='#1a1b1a';ctx.beginPath();ctx.moveTo(-26,-70);ctx.lineTo(76,-92);ctx.lineTo(122,-70);ctx.lineTo(60,-56);ctx.lineTo(36,-12);ctx.lineTo(-8,-20);ctx.closePath();ctx.fill();ctx.fillStyle='#574431';ctx.fillRect(6,-28,34,70);ctx.fillStyle='#111';ctx.fillRect(55,-67,82,9);ctx.fillStyle='#2d2b26';ctx.fillRect(84,-75,58,7);ctx.fillStyle='#b18a61';ctx.beginPath();ctx.ellipse(-8,10,28,18,.3,0,Math.PI*2);ctx.fill();if(muzzle>.03){ctx.fillStyle=`rgba(255,210,92,${Math.min(1,muzzle)})`;ctx.beginPath();ctx.moveTo(142,-71);ctx.lineTo(192,-96);ctx.lineTo(170,-67);ctx.lineTo(198,-50);ctx.lineTo(143,-59);ctx.closePath();ctx.fill()}ctx.restore()}
function drawMinimap(){const mw=148,mh=104,x=W-mw-14,y=14;ctx.save();ctx.globalAlpha=.78;ctx.fillStyle='rgba(9,10,9,.7)';ctx.fillRect(x,y,mw,mh);ctx.strokeStyle='rgba(225,200,150,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+mw/2,y+mh/2,mw*.42,mh*.39,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d6ad62';const sx=x+mw/2+(px/arena.rx)*mw*.42,sy=y+mh/2+(pz/arena.rz)*mh*.39;ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(yaw)*13,sy+Math.sin(yaw)*13);ctx.stroke();ctx.restore()}
function render(){const horizon=H*(.49+pitch*.54-recoil*.12);drawSky(horizon);drawFloor(horizon);const rays=Math.max(320,Math.min(720,Math.floor(W/2.35))),fov=72*Math.PI/180,colW=W/rays;for(let i=0;i<rays;i++){const rel=(i/(rays-1)-.5)*fov,hit=cast(yaw+rel),dist=Math.max(.14,hit.t*Math.cos(rel));const wallH=Math.min(H*1.85,(H*.96)*(hit.h/3.2)/(dist*.071+.39));const y=horizon-wallH*.53;ctx.fillStyle=stoneColor(hit,dist,i);ctx.fillRect(i*colW,y,colW+1,wallH);
  // Horizontal stone courses and slight vertical joints give the walls actual material read.
  if(dist<28){const alpha=Math.max(0,.18-dist*.0048);ctx.fillStyle=`rgba(48,35,23,${alpha})`;for(let k=1;k<5;k++)ctx.fillRect(i*colW,y+wallH*k/5,colW+1,1);if(((i+Math.floor(hit.hx*4))%17)===0)ctx.fillRect(i*colW,y,colW*.8,wallH);
    // T-pillars get restrained carved relief bands rather than plain slabs.
    if(hit.type==='pillar'||hit.type==='cap'){const rel=((i+Math.floor(hit.hz*7))%23);if(rel<2){ctx.fillStyle=`rgba(63,44,27,${Math.max(.05,.24-dist*.006)})`;ctx.fillRect(i*colW,y+wallH*.38,colW+1,Math.max(1,wallH*.055));ctx.fillRect(i*colW,y+wallH*.66,colW+1,Math.max(1,wallH*.035))}}
    if(hit.type==='outer'||hit.type==='ring'){if(((i+Math.floor(hit.hx*3-hit.hz*2))%29)===0){ctx.fillStyle=`rgba(225,190,126,${Math.max(.025,.10-dist*.003)})`;ctx.fillRect(i*colW,y+wallH*.1,colW+1,wallH*.72)}}} }
// distance haze
const haze=ctx.createLinearGradient(0,H*.35,0,H);haze.addColorStop(0,'rgba(232,205,152,.05)');haze.addColorStop(.65,'rgba(150,111,70,.01)');haze.addColorStop(1,'rgba(0,0,0,.08)');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
// drifting dust in the warm backlight
ctx.save();ctx.globalAlpha=.20;for(let j=0;j<22;j++){const xx=(j*173+(performance.now()*.008*(1+j%3)))%W;const yy=(j*97)%Math.max(1,H*.72);const rr=1+(j%3)*.55;ctx.fillStyle=j%2?'rgba(255,227,172,.35)':'rgba(224,194,142,.22)';ctx.beginPath();ctx.arc(xx,yy,rr,0,Math.PI*2);ctx.fill()}ctx.restore();
const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.22,W/2,H/2,Math.max(W,H)*.68);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.36)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);drawWeapon();drawMinimap()}

function update(dt){recoil=Math.max(0,recoil-dt*.28);muzzle=Math.max(0,muzzle-dt*7);if(!locked)return;const f=(down.w?1:0)-(down.s?1:0),s=(down.d?1:0)-(down.a?1:0);if(f||s){const len=Math.hypot(f,s),ff=f/len,ss=s/len,speed=down.shift?8.1:5.15;const dx=(Math.cos(yaw)*ff+Math.cos(yaw+Math.PI/2)*ss)*speed*dt,dz=(Math.sin(yaw)*ff+Math.sin(yaw+Math.PI/2)*ss)*speed*dt;const nx=px+dx,nz=pz+dz;if(valid(nx,pz))px=nx;if(valid(px,nz))pz=nz;bob+=dt*(down.shift?11:8)}else bob+=dt*.7;posEl.textContent=`X ${px.toFixed(1)}  Z ${pz.toFixed(1)}`;hint.textContent=px<-18?'T SPAWN':px>18?'CT SPAWN':Math.abs(px)<10&&Math.abs(pz)<8?'MERKEZ HALKA':'DIŞ KORİDOR'}
function loop(now){const dt=Math.min(.045,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
})();

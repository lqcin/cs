(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const start=document.getElementById('start'),play=document.getElementById('play'),posEl=document.getElementById('pos'),err=document.getElementById('err');
let W=0,H=0,DPR=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,1.5);W=Math.max(640,innerWidth);H=Math.max(360,innerHeight);canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize);resize();

const arena={rx:34.5,rz:23.5};
const obstacles=[];
function circle(x,z,r,h=3.5,type='stone'){obstacles.push({kind:'circle',x,z,r,h,type})}
function rect(x,z,w,d,h=2.2,type='stone'){obstacles.push({kind:'rect',x,z,w,d,h,type})}
// central Göbekli Tepe pillars
circle(0,-1.5,1.25,5.8,'pillar');circle(0,4.2,1.25,5.2,'pillar');circle(-6,0,1.15,4.5,'pillar');circle(6,0,1.15,4.5,'pillar');rect(0,0,4.4,3.0,1.25,'dark');
const covers=[[-18,-11,3,2.2],[-20,10,2.2,2.2],[-10,-18,4,1.8],[-8,17,2.4,2.4],[-27,-5,2.8,2.0],[-27,7,2.6,3.0]];
for(const c of covers){rect(c[0],c[1],c[2],c[3],1.8,'cover');rect(-c[0],c[1],c[2],c[3],1.8,'cover')}
for(const s of [-1,1]){rect(s*15,-4,4.5,1.5,1.4,'stone');rect(s*15,5.5,3.5,1.4,1.9,'stone')}
// small marker pillars around ring
for(let a=0;a<Math.PI*2;a+=Math.PI/6)circle(Math.cos(a)*29,Math.sin(a)*19.2,.58,2.2,'marker');

let px=-29.5,pz=0,yaw=-Math.PI/2,pitch=0,locked=false,last=performance.now();
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true});addEventListener('keyup',e=>{keys[e.code]=false});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw+=e.movementX*0.00245;pitch+=e.movementY*0.0018;pitch=Math.max(-0.34,Math.min(0.34,pitch))});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;start.style.display=locked?'none':'flex'});
play.addEventListener('click',async()=>{try{err.textContent='';if(canvas.requestPointerLock)canvas.requestPointerLock();else{locked=true;start.style.display='none'}}catch(e){err.textContent='Fare kilidi açılamadı. Harita ekranına bir kez daha tıkla.'}});
canvas.addEventListener('click',()=>{if(!locked&&canvas.requestPointerLock)canvas.requestPointerLock()});

function insideArena(x,z,margin=.5){return (x*x)/((arena.rx-margin)**2)+(z*z)/((arena.rz-margin)**2)<1}
function hitsObstacle(x,z,margin=.45){for(const o of obstacles){if(o.kind==='circle'){const dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<(o.r+margin)**2)return true}else{if(Math.abs(x-o.x)<o.w/2+margin&&Math.abs(z-o.z)<o.d/2+margin)return true}}return false}
function valid(x,z){return insideArena(x,z)&&!hitsObstacle(x,z)}

function rayCircle(ox,oz,dx,dz,c){const rx=ox-c.x,rz=oz-c.z,b=rx*dx+rz*dz,cc=rx*rx+rz*rz-c.r*c.r,disc=b*b-cc;if(disc<0)return Infinity;const t=-b-Math.sqrt(disc);return t>0.03?t:Infinity}
function rayRect(ox,oz,dx,dz,r){let tmin=-Infinity,tmax=Infinity;const minx=r.x-r.w/2,maxx=r.x+r.w/2,minz=r.z-r.d/2,maxz=r.z+r.d/2;
if(Math.abs(dx)<1e-8){if(ox<minx||ox>maxx)return Infinity}else{let a=(minx-ox)/dx,b=(maxx-ox)/dx;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(Math.abs(dz)<1e-8){if(oz<minz||oz>maxz)return Infinity}else{let a=(minz-oz)/dz,b=(maxz-oz)/dz;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(tmax<tmin||tmax<0)return Infinity;const t=tmin>0?tmin:tmax;return t>0.03?t:Infinity}
function rayEllipse(ox,oz,dx,dz){const A=dx*dx/(arena.rx*arena.rx)+dz*dz/(arena.rz*arena.rz),B=2*(ox*dx/(arena.rx*arena.rx)+oz*dz/(arena.rz*arena.rz)),C=ox*ox/(arena.rx*arena.rx)+oz*oz/(arena.rz*arena.rz)-1;const D=B*B-4*A*C;if(D<0)return Infinity;const t1=(-B-Math.sqrt(D))/(2*A),t2=(-B+Math.sqrt(D))/(2*A);return t2>0.03?t2:Infinity}

function cast(angle){const dx=Math.cos(angle),dz=Math.sin(angle);let best={t:rayEllipse(px,pz,dx,dz),h:3.2,type:'outer'};for(const o of obstacles){const t=o.kind==='circle'?rayCircle(px,pz,dx,dz,o):rayRect(px,pz,dx,dz,o);if(t<best.t)best={t,h:o.h,type:o.type}}return best}
function color(type,shade){let c= type==='pillar'?[151,123,88]:type==='cover'?[110,83,55]:type==='dark'?[76,58,44]:type==='marker'?[130,106,76]:type==='outer'?[105,83,61]:[126,103,76];return `rgb(${c.map(v=>Math.max(0,Math.min(255,Math.round(v*shade)))).join(',')})`}

function render(){ctx.clearRect(0,0,W,H);const horizon=H*(0.5+pitch*.55);const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#79a7c0');sky.addColorStop(1,'#d6b77e');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);const ground=ctx.createLinearGradient(0,horizon,0,H);ground.addColorStop(0,'#9f7c4f');ground.addColorStop(1,'#3b2b1d');ctx.fillStyle=ground;ctx.fillRect(0,horizon,W,H-horizon);
const rays=Math.max(220,Math.min(520,Math.floor(W/3))),fov=74*Math.PI/180;const colW=W/rays;for(let i=0;i<rays;i++){const rel=(i/(rays-1)-.5)*fov;const hit=cast(yaw+rel);const dist=Math.max(.12,hit.t*Math.cos(rel));const wallH=Math.min(H*1.7,(H*0.95)*(hit.h/3.2)/(dist*.075+0.42));const y=horizon-wallH*.52;const shade=Math.max(.28,1-dist/70);ctx.fillStyle=color(hit.type,shade);ctx.fillRect(i*colW,y,colW+1,wallH);if(dist<18){ctx.fillStyle=`rgba(255,220,160,${Math.max(0,.08-dist*.003)})`;ctx.fillRect(i*colW,y,colW+1,2)}}
// subtle vignette
const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.65);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H)}

function update(dt){if(!locked)return;const fast=keys.ShiftLeft||keys.ShiftRight,speed=fast?9.2:5.5;let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);let len=Math.hypot(f,s)||1;f/=len;s/=len;const dx=(Math.cos(yaw)*f+Math.cos(yaw+Math.PI/2)*s)*speed*dt,dz=(Math.sin(yaw)*f+Math.sin(yaw+Math.PI/2)*s)*speed*dt;const nx=px+dx,nz=pz+dz;if(valid(nx,pz))px=nx;if(valid(px,nz))pz=nz;posEl.textContent=`X ${px.toFixed(1)}  Z ${pz.toFixed(1)}`}
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop)}requestAnimationFrame(loop);
})();

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
const pillarCaps=[];
const scrub=[];
function rect(x,z,w,d,h=2.4,type='stone',rot=0,base=null,collidable=true){obstacles.push({kind:'rect',x,z,w,d,h,type,rot,base,collidable})}
function circle(x,z,r,h=3.4,type='pillar',base=null,collidable=true){obstacles.push({kind:'circle',x,z,r,h,type,base,collidable})}
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
// Central lowered 'Er Meydanı': an oval fighting pit about 1.6 m below the arena.
// East and west gaps are broad stair entries, so the T/CT flow naturally pours into the pit.
const pit={rx:9.2,rz:6.35,depth:1.6,stairOuter:13.0,stairInner:8.0,stairHalfWidth:2.7};
for(let i=0;i<30;i++){
  const a=i/30*Math.PI*2;
  const deg=((a*180/Math.PI)+360)%360;
  const stairGap=(deg<18||deg>342)||(deg>162&&deg<198);
  if(stairGap) continue;
  rect(Math.cos(a)*pit.rx,Math.sin(a)*pit.rz,2.15,1.0,2.1,'pitwall',a+Math.PI/2,-pit.depth,true);
}
// Visual stair risers. They are ray-cast geometry but not collision obstacles.
for(const side of [-1,1]){
  for(let i=0;i<7;i++){
    const t=i/6;
    const x=side*(pit.stairOuter-(pit.stairOuter-pit.stairInner)*t);
    const base=-pit.depth*t;
    rect(x,0,0.32,5.0,0.18,'step',0,base,false);
  }
}

// Göbekli Tepe T-pillars frame the pit rather than clogging its centre.
function tPillar(x,z,rot=0,base=0){rect(x,z,1.55,1.15,3.95,'pillar',rot,base);pillarCaps.push({x,z,w:3.15,d:.72,h:.82,rot,base:base+3.82})}
tPillar(0,-8.5,0);tPillar(0,8.5,0);
for(const p of [[-10.8,-5.7,.45],[-10.8,5.7,-.45],[10.8,-5.7,-.45],[10.8,5.7,.45]]) rect(p[0],p[1],1.25,1.0,3.7,'pillar',p[2]);

// Covers and archaeological blocks, kept symmetrical for first balance pass.
const covers=[[-22,-9,3.4,2.0,1.7],[-22,9,3.4,2.0,1.7],[-17,-14.8,3.8,1.8,1.45],[-17,14.8,3.8,1.8,1.45],[-10.5,-14,2.3,2.3,1.9],[-10.5,14,2.3,2.3,1.9]];
for(const c of covers){rect(...c,'cover',0);rect(-c[0],c[1],c[2],c[3],c[4],'cover',0)}
rect(-18,0,4.8,1.35,1.35,'low',0);rect(18,0,4.8,1.35,1.35,'low',0);
rect(0,-14.5,5.0,1.3,1.5,'low',0);rect(0,14.5,5.0,1.3,1.5,'low',0);
// a few low non-colliding fragments visually break up the floor
for(let i=0;i<18;i++){const a=i*2.399,r=7+(i%5)*3.6;decoRect(Math.cos(a)*r,Math.sin(a)*r*.67,1.1+(i%3)*.5,.65,0.28,'debris',a)}
// Dry scrub and excavation fragments, concentrated near the outer ring so the fighting lanes stay clean.
for(let i=0;i<42;i++){const a=i*2.173+0.31,r=15.5+(i%7)*1.8;const x=Math.cos(a)*Math.min(r,27.3),z=Math.sin(a)*Math.min(r*.69,18.3);if(Math.abs(x)<13&&Math.abs(z)<7)continue;scrub.push({x,z,h:.25+(i%4)*.09,spread:.22+(i%3)*.08,seed:i})}

function inPit(x,z){return (x*x)/(pit.rx*pit.rx)+(z*z)/(pit.rz*pit.rz)<1}
function floorElevation(x,z){
  if(inPit(x,z)) return -pit.depth;
  if(Math.abs(z)<pit.stairHalfWidth){
    const ax=Math.abs(x);
    if(ax<=pit.stairOuter&&ax>=pit.stairInner){
      const t=(pit.stairOuter-ax)/(pit.stairOuter-pit.stairInner);
      return -pit.depth*Math.max(0,Math.min(1,t));
    }
  }
  return 0;
}

let px=-24.8,pz=0,yaw=0,pitch=0,locked=false,last=performance.now();
let bob=0,recoil=0,muzzle=0;
let velX=0,velZ=0,jumpY=0,velY=0,onGround=true;
let mouseHeld=false,fireCooldown=0,reloadTimer=0,ammo=30,reserve=90;
let hp=100,armor=100,damageCooldown=0,roundTime=90,roundReset=0;
let lastCounter=0;
const down={w:false,a:false,s:false,d:false,shift:false,ctrl:false,space:false};
const hpEl=document.getElementById('hp'),armorEl=document.getElementById('armor'),weaponEl=document.getElementById('weapon'),ammoEl=document.getElementById('ammo'),stanceEl=document.getElementById('stance'),speedEl=document.getElementById('speed'),timerEl=document.getElementById('timer'),crossEl=document.getElementById('cross');
function setKey(k,v){if(k in down){down[k]=v;if(keyEls[k])keyEls[k].classList.toggle('on',v)}}
function keyName(e){const k=(e.key||'').toLowerCase();if(k==='w'||e.code==='KeyW')return'w';if(k==='a'||e.code==='KeyA')return'a';if(k==='s'||e.code==='KeyS')return's';if(k==='d'||e.code==='KeyD')return'd';if(k==='shift'||e.code==='ShiftLeft'||e.code==='ShiftRight')return'shift';if(k==='control'||e.code==='ControlLeft'||e.code==='ControlRight')return'ctrl';if(k===' '||e.code==='Space')return'space';return''}
let shotTimer=0;
function showShotMessage(text){const el=document.getElementById('shotmsg');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(shotTimer);shotTimer=setTimeout(()=>el.classList.remove('show'),1100)}
function takeScreenshot(){
  try{canvas.toBlob(blob=>{if(!blob){showShotMessage('Ekran görüntüsü alınamadı');return}const d=new Date(),pad=n=>String(n).padStart(2,'0');const name=`gobeklitepe_v08_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showShotMessage('F2 • EKRAN GÖRÜNTÜSÜ KAYDEDİLDİ')},'image/png')
  }catch(_){showShotMessage('Ekran görüntüsü alınamadı')}
}
function startReload(){if(inPit(px,pz)||reloadTimer>0||ammo>=30||reserve<=0)return;reloadTimer=2.45;mouseHeld=false;showShotMessage('ŞARJÖR DEĞİŞTİRİLİYOR')}
function jump(){if(onGround&&!down.ctrl){velY=6.15;onGround=false;jumpY=.025}}
function onKey(e,v){
  if(v&&!e.repeat&&(e.code==='F2'||e.code==='KeyP')){e.preventDefault();e.stopPropagation();takeScreenshot();return}
  if(v&&!e.repeat&&e.code==='KeyR'){e.preventDefault();e.stopPropagation();startReload();return}
  const k=keyName(e);if(!k)return;if(v&&k==='space'&&!down.space)jump();setKey(k,v);e.preventDefault();e.stopPropagation()
}
document.addEventListener('keydown',e=>onKey(e,true),true);document.addEventListener('keyup',e=>onKey(e,false),true);window.addEventListener('blur',()=>{Object.keys(down).forEach(k=>setKey(k,false));mouseHeld=false});
function lockGame(){canvas.focus({preventScroll:true});if(canvas.requestPointerLock){canvas.requestPointerLock()}else{locked=true;start.style.display='none'}}
play.addEventListener('click',()=>{err.textContent='';lockGame()});canvas.addEventListener('click',()=>{if(!locked)lockGame()});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){start.style.display='none';canvas.focus({preventScroll:true})}else{start.style.display='flex';Object.keys(down).forEach(k=>setKey(k,false));mouseHeld=false}});
document.addEventListener('pointerlockerror',()=>{err.textContent='Fare kilidi tarayıcı tarafından engellendi. Sayfaya bir kez tıklayıp tekrar dene.'});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw+=e.movementX*0.00228;pitch+=e.movementY*0.00172;pitch=Math.max(-0.42,Math.min(0.42,pitch))});
document.addEventListener('mousedown',e=>{if(!locked||e.button!==0)return;mouseHeld=true;tryFire()});document.addEventListener('mouseup',e=>{if(e.button===0)mouseHeld=false});
function cameraEyeHeight(){return down.ctrl&&onGround?1.13:1.62}
function cameraY(){return floorElevation(px,pz)+cameraEyeHeight()+jumpY}
function tryFire(){
  if(!locked||fireCooldown>0||reloadTimer>0)return;
  if(inPit(px,pz)){fireCooldown=.42;muzzle=1;recoil=Math.min(.075,recoil+.042);showShotMessage('BIÇAK');return}
  if(ammo<=0){fireCooldown=.16;showShotMessage('ŞARJÖR BOŞ • R');return}
  ammo--;fireCooldown=.098;muzzle=1;
  const speed=Math.hypot(velX,velZ),air=!onGround;let spread=.0018+Math.min(.020,speed*.0023)+(air?.020:0)+(down.ctrl?-.0008:0);spread=Math.max(.0012,spread);
  const rx=(Math.random()-.5)*spread,ry=(Math.random()-.5)*spread;
  yaw+=rx*.8;pitch-=.0052+Math.min(.0045,recoil*.05)+ry*.5;pitch=Math.max(-.42,Math.min(.42,pitch));recoil=Math.min(.105,recoil+.0135);
}
function respawn(msg='ROUND RESET'){
  px=-24.8;pz=0;velX=velZ=velY=jumpY=0;onGround=true;hp=100;armor=100;ammo=30;reserve=90;reloadTimer=0;roundTime=90;roundReset=.7;showShotMessage(msg)
}
function localRectPoint(x,z,r){const c=Math.cos(-r.rot),s=Math.sin(-r.rot),dx=x-r.x,dz=z-r.z;return{x:dx*c-dz*s,z:dx*s+dz*c}}
function insideArena(x,z,margin=.55){return (x*x)/((arena.rx-margin)**2)+(z*z)/((arena.rz-margin)**2)<1}
function hitsObstacle(x,z,margin=.45){for(const o of obstacles){if(o.collidable===false)continue;if(o.kind==='circle'){const dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<(o.r+margin)**2)return true}else{const p=localRectPoint(x,z,o);if(Math.abs(p.x)<o.w/2+margin&&Math.abs(p.z)<o.d/2+margin)return true}}return false}
function valid(x,z){return insideArena(x,z)&&!hitsObstacle(x,z)}

function rayCircle(ox,oz,dx,dz,c){const rx=ox-c.x,rz=oz-c.z,b=rx*dx+rz*dz,cc=rx*rx+rz*rz-c.r*c.r,disc=b*b-cc;if(disc<0)return Infinity;const t=-b-Math.sqrt(disc);return t>0.03?t:Infinity}
function rayRect(ox,oz,dx,dz,r){const c=Math.cos(-r.rot),s=Math.sin(-r.rot);const rox=(ox-r.x)*c-(oz-r.z)*s,roz=(ox-r.x)*s+(oz-r.z)*c;const rdx=dx*c-dz*s,rdz=dx*s+dz*c;let tmin=-Infinity,tmax=Infinity;const minx=-r.w/2,maxx=r.w/2,minz=-r.d/2,maxz=r.d/2;
if(Math.abs(rdx)<1e-9){if(rox<minx||rox>maxx)return Infinity}else{let a=(minx-rox)/rdx,b=(maxx-rox)/rdx;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(Math.abs(rdz)<1e-9){if(roz<minz||roz>maxz)return Infinity}else{let a=(minz-roz)/rdz,b=(maxz-roz)/rdz;if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b)}
if(tmax<tmin||tmax<0)return Infinity;const t=tmin>0?tmin:tmax;return t>0.03?t:Infinity}
function rayEllipse(ox,oz,dx,dz){const A=dx*dx/(arena.rx*arena.rx)+dz*dz/(arena.rz*arena.rz),B=2*(ox*dx/(arena.rx*arena.rx)+oz*dz/(arena.rz*arena.rz)),C=ox*ox/(arena.rx*arena.rx)+oz*oz/(arena.rz*arena.rz)-1,D=B*B-4*A*C;if(D<0)return Infinity;const t2=(-B+Math.sqrt(D))/(2*A);return t2>0.03?t2:Infinity}
function cast(angle){const dx=Math.cos(angle),dz=Math.sin(angle);let t=rayEllipse(px,pz,dx,dz),best={t,h:3.0,type:'edge',hx:px+dx*t,hz:pz+dz*t,base:0,obj:null};for(const o of obstacles){const q=o.kind==='circle'?rayCircle(px,pz,dx,dz,o):rayRect(px,pz,dx,dz,o);if(q<t){t=q;const hx=px+dx*q,hz=pz+dz*q;best={t:q,h:o.h,type:o.type,hx,hz,base:o.base==null?floorElevation(hx,hz):o.base,obj:o}}}return best}

const palette={outer:[173,145,103],edge:[116,91,64],ring:[174,145,101],pitwall:[157,126,84],step:[185,153,106],pillar:[194,166,119],cap:[202,174,123],cover:[144,111,74],low:[154,121,82],debris:[126,96,65]};
function surfaceU(hit){
  if(!hit.obj||hit.obj.kind!=='rect')return .5;
  const p=localRectPoint(hit.hx,hit.hz,hit.obj),ox=Math.abs(Math.abs(p.x)-hit.obj.w/2),oz=Math.abs(Math.abs(p.z)-hit.obj.d/2);
  return ox<oz?(p.z/hit.obj.d+.5):(p.x/hit.obj.w+.5);
}
function stoneColor(hit,dist,rayIndex){
  const base=palette[hit.type]||palette.outer,u=surfaceU(hit);
  const coarse=.94+((Math.sin(hit.hx*7.1+hit.hz*4.8+rayIndex*.071)+Math.sin(hit.hx*15.7-hit.hz*9.2))*0.028);
  const block=((Math.floor((u+.015)*6)+Math.floor((hit.hx-hit.hz)*.36))%2)?1:.91;
  const fog=Math.max(.44,1-dist/78);
  const sunAngle=Math.atan2(hit.hz,hit.hx),light=.82+.24*Math.max(0,Math.sin(sunAngle+1.05));
  const weather=hit.type==='pillar'?1.06:hit.type==='pitwall'?.96:1;
  const mul=coarse*block*fog*light*weather;
  return `rgb(${base.map(v=>Math.max(0,Math.min(255,Math.round(v*mul)))).join(',')})`;
}

function drawSky(horizon){
  const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#6f9daf');sky.addColorStop(.52,'#a9bdba');sky.addColorStop(1,'#e7c98e');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);
  const sunX=W*.76,sunY=Math.max(35,horizon*.28);const sg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,H*.25);sg.addColorStop(0,'rgba(255,246,211,.92)');sg.addColorStop(.10,'rgba(255,225,159,.38)');sg.addColorStop(1,'rgba(255,218,148,0)');ctx.fillStyle=sg;ctx.fillRect(0,0,W,horizon);
  ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#8c816b';ctx.beginPath();ctx.moveTo(0,horizon);for(let x=0;x<=W;x+=W/16){const yy=horizon-26-Math.sin(x*.010+1.1)*13-Math.sin(x*.024)*6;ctx.lineTo(x,yy)}ctx.lineTo(W,horizon);ctx.closePath();ctx.fill();
  ctx.globalAlpha=.26;ctx.fillStyle='#6f685d';ctx.beginPath();ctx.moveTo(0,horizon);for(let x=0;x<=W;x+=W/20){const yy=horizon-10-Math.sin(x*.016+2.4)*10-Math.sin(x*.039)*4;ctx.lineTo(x,yy)}ctx.lineTo(W,horizon);ctx.closePath();ctx.fill();ctx.restore();
  const warm=ctx.createLinearGradient(0,horizon*.65,0,horizon);warm.addColorStop(0,'rgba(255,226,166,0)');warm.addColorStop(1,'rgba(227,172,97,.16)');ctx.fillStyle=warm;ctx.fillRect(0,0,W,horizon);
}
function hash2(ix,iz){let n=(ix*374761393+iz*668265263)|0;n=(n^(n>>>13))*1274126177;n=(n^(n>>>16))>>>0;return n/4294967295}
function floorTileColor(ix,iz,elev,depth){const h=hash2(ix,iz);let base;if(elev<-.7){base=h>.72?[126,91,54]:h>.28?[139,103,63]:[151,115,72]}else{base=h>.78?[176,141,94]:h>.44?[157,122,80]:h>.16?[143,108,70]:[184,148,99]}const fog=Math.max(.48,1-depth/78);const sun=.91+.10*Math.sin(ix*.71+iz*.37);return `rgb(${base.map(v=>Math.round(v*fog*sun)).join(',')})`}
function floorVertex(ix,iz,step){const jx=(hash2(ix*11+7,iz*13-3)-.5)*.32,jz=(hash2(ix*17-5,iz*19+9)-.5)*.32;return{x:ix*step+jx,z:iz*step+jz}}
// Ground is now true world geometry. The stones are fixed to X/Z coordinates,
// so the camera moves over the floor instead of a screen-space texture sliding with the player.
function drawFloor(horizon){
  const g=ctx.createLinearGradient(0,horizon,0,H);g.addColorStop(0,'#b49368');g.addColorStop(.48,'#85613e');g.addColorStop(1,'#3b281b');ctx.fillStyle=g;ctx.fillRect(0,horizon,W,H-horizon);
  const step=1.72,tiles=[];
  const minX=Math.floor(-arena.rx/step)-1,maxX=Math.ceil(arena.rx/step)+1,minZ=Math.floor(-arena.rz/step)-1,maxZ=Math.ceil(arena.rz/step)+1;
  for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
    const v00=floorVertex(ix,iz,step),v10=floorVertex(ix+1,iz,step),v11=floorVertex(ix+1,iz+1,step),v01=floorVertex(ix,iz+1,step);
    const cx=(v00.x+v10.x+v11.x+v01.x)/4,cz=(v00.z+v10.z+v11.z+v01.z)/4;
    if((cx*cx)/(arena.rx*arena.rx)+(cz*cz)/(arena.rz*arena.rz)>.985)continue;
    const elev=floorElevation(cx,cz)+.015,pc=projectWorld(cx,elev,cz,horizon);if(!pc||pc.depth>58.2)continue;
    const pts=[v00,v10,v11,v01].map(v=>projectWorld(v.x,floorElevation(v.x,v.z)+.012,v.z,horizon));if(pts.some(q=>!q))continue;if(pts.every(q=>q.y<horizon-8||q.y>H+160))continue;
    tiles.push({ix,iz,elev,depth:pc.depth,pts});
  }
  tiles.sort((a,b)=>b.depth-a.depth);ctx.save();
  for(const t of tiles){const p=t.pts;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.lineTo(p[3].x,p[3].y);ctx.closePath();ctx.fillStyle=floorTileColor(t.ix,t.iz,t.elev,t.depth);ctx.fill();
    const a=Math.max(.045,.24-t.depth*.0046);ctx.strokeStyle=`rgba(57,39,24,${a})`;ctx.lineWidth=t.depth<7?1.25:.7;ctx.stroke();
    const chip=hash2(t.ix+91,t.iz-37);if(t.depth<18&&chip>.67){const q0=p[0],q2=p[2],m=.16+hash2(t.ix-12,t.iz+31)*.22;ctx.strokeStyle=`rgba(63,42,26,${Math.max(.04,.18-t.depth*.007)})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(q0.x+(q2.x-q0.x)*m,q0.y+(q2.y-q0.y)*m);ctx.lineTo(q0.x+(q2.x-q0.x)*(.63+m*.18),q0.y+(q2.y-q0.y)*(.58+m*.22));ctx.stroke()}
  }
  ctx.restore();drawGroundDetails(horizon);
}
function drawGroundDetails(horizon){
  const rubble=[];
  for(const d of decorative){const y=floorElevation(d.x,d.z)+.03,p=projectWorld(d.x,y,d.z,horizon);if(!p||p.depth>34)continue;const ang=d.rot,hw=d.w/2,hd=d.d/2,c=Math.cos(ang),sn=Math.sin(ang),pts=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([lx,lz])=>projectWorld(d.x+lx*c-lz*sn,y,d.z+lx*sn+lz*c,horizon));if(pts.some(q=>!q))continue;rubble.push({p,pts,d})}
  rubble.sort((a,b)=>b.p.depth-a.p.depth);ctx.save();for(const r of rubble){const p=r.pts,alpha=Math.max(.16,.72-r.p.depth/46);ctx.globalAlpha=alpha;ctx.fillStyle=hash2(Math.round(r.d.x*9),Math.round(r.d.z*9))>.5?'#8e6945':'#6f5137';ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<4;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(44,30,20,.45)';ctx.lineWidth=.7;ctx.stroke()}ctx.restore();
  const plants=[];for(const g of scrub){const y=floorElevation(g.x,g.z),p=projectWorld(g.x,y,g.z,horizon);if(p&&p.depth<30)plants.push({g,p})}plants.sort((a,b)=>b.p.depth-a.p.depth);ctx.save();for(const {g,p} of plants){const sz=Math.max(2,Math.min(14,p.scale*g.h*.58));ctx.globalAlpha=Math.max(.12,.62-p.depth/55);ctx.strokeStyle=g.seed%2?'#746844':'#85734a';ctx.lineWidth=Math.max(.55,sz*.10);for(let k=-2;k<=2;k++){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+k*sz*.26,p.y-sz*(.65+Math.abs(k)*.10));ctx.stroke()}}ctx.restore();
}
const knives=[];
for(let i=0;i<11;i++){
  const a=i/11*Math.PI*2;
  knives.push({x:Math.cos(a)*7.1,z:Math.sin(a)*4.7,y:.55+(i%4)*.34,vx:-Math.sin(a)*(3.0+(i%3)*.45),vz:Math.cos(a)*(2.2+(i%2)*.35),phase:i*.73});
}
function updateKnives(dt){
  for(const k of knives){
    k.x+=k.vx*dt;k.z+=k.vz*dt;k.phase+=dt*7;
    const q=(k.x*k.x)/(7.7*7.7)+(k.z*k.z)/(5.15*5.15);
    if(q>1.05){k.vx*=-1;k.vz*=-1;k.x+=k.vx*dt*2;k.z+=k.vz*dt*2}
    k.y=.75+Math.abs(Math.sin(k.phase*.52))*1.45;
    if(locked&&inPit(px,pz)&&damageCooldown<=0){const dx=px-k.x,dz=pz-k.z;if(dx*dx+dz*dz<.58*.58&&k.y<1.75+jumpY){let dmg=22;const absorbed=Math.min(armor,dmg*.45);armor-=absorbed;hp-=dmg-absorbed;damageCooldown=.7;document.body.classList.remove('damage');void document.body.offsetWidth;document.body.classList.add('damage');showShotMessage('UÇAN BIÇAK • -'+Math.round(dmg-absorbed));if(hp<=0)respawn('ÖLDÜN • YENİDEN DOĞDUN')}}
  }
}
function projectWorld(x,y,z,horizon){
  const dx=x-px,dz=z-pz,cy=Math.cos(yaw),sy=Math.sin(yaw);
  const f=dx*cy+dz*sy,side=-dx*sy+dz*cy;if(f<.35)return null;
  const focal=W/(2*Math.tan((72*Math.PI/180)/2));
  const camY=cameraY();
  return{x:W/2+(side/f)*focal,y:horizon-((y-camY)/f)*focal,scale:focal/f,depth:f};
}
function drawFlyingKnives(horizon){
  const arr=[];for(const k of knives){const p=projectWorld(k.x,k.y-pit.depth,k.z,horizon);if(p&&p.x>-100&&p.x<W+100&&p.y>-100&&p.y<H+100)arr.push([p,k])}
  arr.sort((a,b)=>b[0].depth-a[0].depth);
  for(const [p,k] of arr){const sz=Math.max(5,Math.min(38,p.scale*.32));ctx.save();ctx.translate(p.x,p.y);const ang=Math.atan2(k.vz,k.vx)-yaw;ctx.rotate(ang);ctx.globalAlpha=Math.max(.32,1-p.depth/28);ctx.strokeStyle='rgba(230,224,205,.35)';ctx.lineWidth=Math.max(1,sz*.045);ctx.beginPath();ctx.moveTo(-sz*1.8,0);ctx.lineTo(-sz*.35,0);ctx.stroke();ctx.fillStyle='#d9dde0';ctx.beginPath();ctx.moveTo(-sz*.25,-sz*.16);ctx.lineTo(sz*1.35,0);ctx.lineTo(-sz*.25,sz*.16);ctx.closePath();ctx.fill();ctx.fillStyle='#5a3b24';ctx.fillRect(-sz*.9,-sz*.12,sz*.68,sz*.24);ctx.restore()}
}
function capVisible(c){const dx=c.x-px,dz=c.z-pz,dist=Math.hypot(dx,dz),ang=Math.atan2(dz,dx),h=cast(ang);return h.t>dist-1.45||h.obj===null}
function drawPillarCaps(horizon){
  const list=[];for(const c of pillarCaps){if(!capVisible(c))continue;const ux=Math.cos(c.rot),uz=Math.sin(c.rot),a=projectWorld(c.x-ux*c.w/2,c.base,c.z-uz*c.w/2,horizon),b=projectWorld(c.x+ux*c.w/2,c.base,c.z+uz*c.w/2,horizon),bt=projectWorld(c.x+ux*c.w/2,c.base+c.h,c.z+uz*c.w/2,horizon),at=projectWorld(c.x-ux*c.w/2,c.base+c.h,c.z-uz*c.w/2,horizon);if(!a||!b||!bt||!at)continue;list.push({c,p:[a,b,bt,at],depth:(a.depth+b.depth)/2})}
  list.sort((a,b)=>b.depth-a.depth);ctx.save();for(const it of list){const p=it.p,d=it.depth,alpha=Math.max(.25,1-d/48);ctx.globalAlpha=alpha;const grad=ctx.createLinearGradient(p[0].x,p[0].y,p[1].x,p[1].y);grad.addColorStop(0,'#a98458');grad.addColorStop(.5,'#d0ad76');grad.addColorStop(1,'#8b6b48');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<4;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(59,43,29,.58)';ctx.lineWidth=Math.max(.7,2.2-d*.05);ctx.stroke();const cx=(p[0].x+p[1].x+p[2].x+p[3].x)/4,cy=(p[0].y+p[1].y+p[2].y+p[3].y)/4,w=Math.abs(p[1].x-p[0].x);ctx.strokeStyle='rgba(84,58,35,.46)';ctx.lineWidth=Math.max(.6,w*.012);ctx.beginPath();ctx.moveTo(cx-w*.16,cy);ctx.quadraticCurveTo(cx,cy-w*.08,cx+w*.16,cy);ctx.stroke()}ctx.restore();
}
function drawKnifeWeapon(){const swing=Math.sin(performance.now()*.012)*(muzzle>.02?1:0);ctx.save();ctx.translate(W*.64,H*.94);ctx.rotate(-.58+swing*.34-recoil*.28);const blade=ctx.createLinearGradient(0,0,180,0);blade.addColorStop(0,'#7f8586');blade.addColorStop(.42,'#d7dad7');blade.addColorStop(.72,'#f1eee2');blade.addColorStop(1,'#8e9493');ctx.fillStyle=blade;ctx.beginPath();ctx.moveTo(-2,-12);ctx.lineTo(156,-28);ctx.lineTo(190,-11);ctx.lineTo(158,3);ctx.lineTo(3,9);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(41,38,33,.7)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#3b2b20';ctx.fillRect(-54,-17,61,32);ctx.fillStyle='#a77f52';for(let i=0;i<5;i++)ctx.fillRect(-48+i*12,-16,3.5,30);ctx.fillStyle='#171512';ctx.fillRect(-4,-23,8,44);ctx.restore()}

function drawWeapon(){if(inPit(px,pz)){drawKnifeWeapon();return}const cx=W*.58,cy=H*.955+Math.sin(bob*2)*2.6+recoil*H*.32;ctx.save();ctx.translate(cx,cy);ctx.rotate(-.045-recoil*.48);
  ctx.fillStyle='#161817';ctx.beginPath();ctx.moveTo(-74,-45);ctx.lineTo(-8,-67);ctx.lineTo(56,-75);ctx.lineTo(92,-63);ctx.lineTo(55,-49);ctx.lineTo(24,-17);ctx.lineTo(-32,-17);ctx.closePath();ctx.fill();
  const wood=ctx.createLinearGradient(-60,-40,35,25);wood.addColorStop(0,'#513421');wood.addColorStop(.5,'#8c5d34');wood.addColorStop(1,'#b27a43');ctx.fillStyle=wood;ctx.beginPath();ctx.moveTo(-72,-42);ctx.lineTo(-20,-58);ctx.lineTo(-4,-40);ctx.lineTo(-36,-18);ctx.lineTo(-77,-22);ctx.closePath();ctx.fill();
  ctx.fillStyle='#252522';ctx.fillRect(18,-62,78,17);ctx.fillStyle='#101110';ctx.fillRect(83,-60,92,7);ctx.fillRect(153,-64,22,14);ctx.fillStyle='#393936';ctx.fillRect(107,-67,48,4);
  ctx.fillStyle='#151615';ctx.beginPath();ctx.moveTo(12,-20);ctx.lineTo(45,-15);ctx.lineTo(36,47);ctx.lineTo(10,52);ctx.lineTo(-3,-5);ctx.closePath();ctx.fill();ctx.strokeStyle='#4d4438';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=wood;ctx.beginPath();ctx.moveTo(-92,-34);ctx.lineTo(-139,-23);ctx.lineTo(-146,-9);ctx.lineTo(-90,-17);ctx.closePath();ctx.fill();
  ctx.fillStyle='#9b7d60';ctx.beginPath();ctx.ellipse(-10,13,28,18,.24,0,Math.PI*2);ctx.fill();ctx.fillStyle='#413a31';ctx.beginPath();ctx.ellipse(-19,19,22,12,.2,0,Math.PI*2);ctx.fill();
  if(muzzle>.03){ctx.fillStyle=`rgba(255,218,108,${Math.min(1,muzzle)})`;ctx.beginPath();ctx.moveTo(176,-60);ctx.lineTo(218,-84);ctx.lineTo(201,-58);ctx.lineTo(224,-42);ctx.lineTo(178,-51);ctx.closePath();ctx.fill();ctx.fillStyle=`rgba(255,244,191,${Math.min(.95,muzzle)})`;ctx.beginPath();ctx.arc(181,-57,7,0,Math.PI*2);ctx.fill()}ctx.restore()}
function drawMinimap(){const mw=154,mh=108,x=W-mw-14,y=14;ctx.save();ctx.globalAlpha=.86;ctx.fillStyle='rgba(9,12,11,.70)';ctx.fillRect(x,y,mw,mh);ctx.strokeStyle='rgba(224,199,149,.25)';ctx.strokeRect(x+.5,y+.5,mw-1,mh-1);ctx.strokeStyle='rgba(225,200,150,.62)';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(x+mw/2,y+mh/2,mw*.42,mh*.39,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(203,153,82,.76)';ctx.beginPath();ctx.ellipse(x+mw/2,y+mh/2,(pit.rx/arena.rx)*mw*.42,(pit.rz/arena.rz)*mh*.39,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(187,77,54,.85)';ctx.fillRect(x+15,y+mh/2-3,6,6);ctx.fillStyle='rgba(66,129,174,.9)';ctx.fillRect(x+mw-21,y+mh/2-3,6,6);ctx.fillStyle='#efd08b';const sx=x+mw/2+(px/arena.rx)*mw*.42,sy=y+mh/2+(pz/arena.rz)*mh*.39;ctx.beginPath();ctx.arc(sx,sy,3.8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(yaw)*13,sy+Math.sin(yaw)*13);ctx.stroke();ctx.restore()}
function render(){const horizon=H*(.49+pitch*.54-recoil*.12);drawSky(horizon);drawFloor(horizon);const rays=Math.max(360,Math.min(760,Math.floor(W/2.25))),fov=72*Math.PI/180,colW=W/rays;const camY=cameraY();const focal=H*.86;for(let i=0;i<rays;i++){const rel=(i/(rays-1)-.5)*fov,hit=cast(yaw+rel),dist=Math.max(.14,hit.t*Math.cos(rel));const scale=focal/(dist*.16+.46);const baseY=hit.base==null?0:hit.base,topY=baseY+hit.h;let yTop=horizon-(topY-camY)*scale,yBase=horizon-(baseY-camY)*scale;let wallH=yBase-yTop;if(wallH<1){wallH=1;yBase=yTop+1}ctx.fillStyle=stoneColor(hit,dist,i);ctx.fillRect(i*colW,yTop,colW+1,wallH);
  if(dist<31){const u=surfaceU(hit),alpha=Math.max(0,.20-dist*.0049);ctx.fillStyle=`rgba(63,45,29,${alpha})`;for(let k=1;k<5;k++)ctx.fillRect(i*colW,yTop+wallH*k/5,colW+1,Math.max(.7,1.15-dist*.015));if(((Math.floor(u*17)+Math.floor((hit.hx-hit.hz)*.8))%5)===0)ctx.fillRect(i*colW,yTop,colW*.75,wallH);
    if(hit.type==='pillar'){const relief=Math.max(.04,.25-dist*.0062);ctx.fillStyle=`rgba(74,51,31,${relief})`;if(u>.18&&u<.25)ctx.fillRect(i*colW,yTop+wallH*.22,colW+1,wallH*.50);if(u>.69&&u<.77)ctx.fillRect(i*colW,yTop+wallH*.38,colW+1,wallH*.22);ctx.fillStyle=`rgba(224,190,132,${relief*.48})`;if(u>.43&&u<.49)ctx.fillRect(i*colW,yTop+wallH*.16,colW+1,wallH*.55)}
    if(hit.type==='outer'||hit.type==='pitwall'||hit.type==='cover'){if(((i+Math.floor(hit.hx*3-hit.hz*2))%31)===0){ctx.fillStyle=`rgba(235,204,151,${Math.max(.025,.11-dist*.003)})`;ctx.fillRect(i*colW,yTop+wallH*.08,colW+1,wallH*.76)}}}}
  drawPillarCaps(horizon);
  const haze=ctx.createLinearGradient(0,H*.34,0,H);haze.addColorStop(0,'rgba(245,222,178,.055)');haze.addColorStop(.62,'rgba(188,142,86,.018)');haze.addColorStop(1,'rgba(57,35,21,.055)');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=.17;for(let j=0;j<26;j++){const xx=(j*173+(performance.now()*.006*(1+j%3)))%W,yy=(j*97)%Math.max(1,H*.70),rr=1+(j%3)*.48;ctx.fillStyle=j%2?'rgba(255,235,190,.34)':'rgba(232,203,151,.23)';ctx.beginPath();ctx.arc(xx,yy,rr,0,Math.PI*2);ctx.fill()}ctx.restore();
  if(inPit(px,pz)){const pitGlow=ctx.createRadialGradient(W/2,H*.62,0,W/2,H*.62,H*.52);pitGlow.addColorStop(0,'rgba(190,116,58,.08)');pitGlow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=pitGlow;ctx.fillRect(0,0,W,H)}
  const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.26,W/2,H/2,Math.max(W,H)*.72);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.23)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);drawFlyingKnives(horizon);drawWeapon();drawMinimap()}

function update(dt){
  recoil=Math.max(0,recoil-dt*.23);muzzle=Math.max(0,muzzle-dt*8.5);fireCooldown=Math.max(0,fireCooldown-dt);damageCooldown=Math.max(0,damageCooldown-dt);roundReset=Math.max(0,roundReset-dt);updateKnives(dt);
  if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){const need=30-ammo,take=Math.min(need,reserve);ammo+=take;reserve-=take;showShotMessage('AK-47 HAZIR')}}
  if(locked&&mouseHeld){tryFire()}
  if(!locked){updateHud();return}
  roundTime-=dt;if(roundTime<=0&&roundReset<=0)respawn('SÜRE BİTTİ • YENİ ROUND');

  const forward=(down.w?1:0)-(down.s?1:0),strafe=(down.d?1:0)-(down.a?1:0);
  let wishX=0,wishZ=0,wishSpeed=0;
  if(forward||strafe){
    const localLen=Math.hypot(forward,strafe),f=forward/localLen,sd=strafe/localLen;
    wishX=Math.cos(yaw)*f+Math.cos(yaw+Math.PI/2)*sd;wishZ=Math.sin(yaw)*f+Math.sin(yaw+Math.PI/2)*sd;
    const weaponMax=inPit(px,pz)?6.25:5.65;
    let mult=1;if(forward<0)mult*=.78;if(Math.abs(strafe)>0&&forward===0)mult*=.96;if(down.shift)mult*=.52;if(down.ctrl)mult*=.38;
    wishSpeed=weaponMax*mult;
  }
  const speed=Math.hypot(velX,velZ);
  if(onGround){
    if(!forward&&!strafe){const friction=8.6,control=Math.max(speed,1.9),drop=control*friction*dt,newSpeed=Math.max(0,speed-drop);if(speed>0){velX*=newSpeed/speed;velZ*=newSpeed/speed}}
    if(wishSpeed>0){const current=velX*wishX+velZ*wishZ,opp=current<-.25;const accel=opp?24.5:13.8;const add=wishSpeed-current;if(add>0){const acc=Math.min(add,accel*wishSpeed*dt);velX+=wishX*acc;velZ+=wishZ*acc}if(opp&&speed>1.0)lastCounter=.18}
  }else if(wishSpeed>0){const current=velX*wishX+velZ*wishZ,add=wishSpeed-current;if(add>0){const acc=Math.min(add,2.2*wishSpeed*dt);velX+=wishX*acc;velZ+=wishZ*acc}}
  lastCounter=Math.max(0,lastCounter-dt);
  let maxVel=(inPit(px,pz)?6.35:5.8)*(down.shift ? .58 : 1)*(down.ctrl ? .48 : 1),hs=Math.hypot(velX,velZ);if(hs>maxVel){velX*=maxVel/hs;velZ*=maxVel/hs}

  if(!onGround){velY-=17.8*dt;jumpY+=velY*dt;if(jumpY<=0){jumpY=0;velY=0;onGround=true}}
  const dx=velX*dt,dz=velZ*dt,nx=px+dx,nz=pz+dz;
  if(valid(nx,pz))px=nx;else velX=0;
  if(valid(px,nz))pz=nz;else velZ=0;
  hs=Math.hypot(velX,velZ);if(hs>.2)bob+=dt*(onGround?(down.shift?5.2:8.5):2.0);else bob+=dt*.45;
  updateHud();
}
function updateHud(){
  const hs=Math.hypot(velX,velZ),pitNow=inPit(px,pz);posEl.textContent=`X ${px.toFixed(1)}  Z ${pz.toFixed(1)} • ${hs.toFixed(1)} m/s`;
  hint.textContent=lastCounter>0?'COUNTER-STRAFE':px<-18?'T SPAWN':px>18?'CT SPAWN':pitNow?'ER MEYDANI • BIÇAK ALANI':Math.abs(pz)<3&&Math.abs(px)<13?'MERDİVEN':'DIŞ KORİDOR';
  hpEl.textContent=Math.max(0,Math.ceil(hp));armorEl.textContent=Math.max(0,Math.ceil(armor));weaponEl.textContent=pitNow?'BIÇAK':'AK-47';ammoEl.textContent=pitNow?'∞':reloadTimer>0?'DOLDURULUYOR':`${ammo} / ${reserve}`;speedEl.textContent=`${hs.toFixed(1)} m/s`;
  stanceEl.textContent=!onGround?'HAVADA':down.ctrl?'ÇÖMEL':down.shift?'SESSİZ YÜRÜ':lastCounter>0?'COUNTER-STRAFE':'KOŞU';
  const m=Math.floor(Math.max(0,roundTime)/60),sec=Math.floor(Math.max(0,roundTime)%60);timerEl.textContent=`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  const spread=Math.min(.55,(hs/6.3)*.32+(onGround?0:.22)+recoil*2.0);crossEl.style.transform=`translate(-50%,-50%) scale(${1+spread})`;crossEl.style.opacity=reloadTimer>0?.55:1;
}
function loop(now){const dt=Math.min(.045,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
})();

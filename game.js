(()=>{
'use strict';
const canvas=document.getElementById('game');
const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
const start=document.getElementById('start'),play=document.getElementById('play'),err=document.getElementById('err');
const posEl=document.getElementById('pos'),hint=document.getElementById('hint'),speedEl=document.getElementById('speed'),stanceEl=document.getElementById('stance'),ammoEl=document.getElementById('ammo'),timerEl=document.getElementById('timer');
const weapon=document.getElementById('weapon'),knifeWeapon=document.getElementById('knifeWeapon'),shotmsg=document.getElementById('shotmsg');
const keyEls={};document.querySelectorAll('#keys [data-k]').forEach(el=>keyEls[el.dataset.k]=el);
if(!gl){err.textContent='WebGL2 açılamadı. Edge/Chrome grafik hızlandırmasını kontrol et.';play.disabled=true;return}

const VS=`#version 300 es
precision highp float;
in vec3 aPos;in vec3 aNormal;
uniform mat4 uModel,uView,uProj;
out vec3 vWorld;out vec3 vNormal;
void main(){vec4 w=uModel*vec4(aPos,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uProj*uView*w;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vWorld;in vec3 vNormal;
uniform vec3 uCam,uFog;uniform int uMat;
out vec4 outColor;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
vec2 surfUV(vec3 p,vec3 n){vec3 an=abs(n);if(an.y>an.x&&an.y>an.z)return p.xz; if(an.x>an.z)return p.zy; return p.xy;}
vec3 stone(vec3 p,vec3 n,int mat){vec2 uv=surfUV(p,n);float s=mat==2?1.65:(mat==3?1.15:2.25);vec2 q=uv/s;vec2 cell=floor(q);vec2 f=fract(q);if(mod(cell.y,2.0)>0.5)f.x=fract(f.x+.5);float mortar=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));float joint=smoothstep(.025,.07,mortar);float rnd=hash21(cell);float grain=noise2(uv*3.4)+.45*noise2(uv*10.0);vec3 base=mat==3?vec3(.46,.32,.19):(mat==2?vec3(.61,.47,.31):vec3(.66,.52,.34));base*=.86+rnd*.18;base*=.86+grain*.12;vec3 grout=vec3(.23,.18,.12);return mix(grout,base,joint);}
vec3 floorTex(vec3 p){vec2 q=p.xz/1.65;vec2 c=floor(q),f=fract(q);float edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));float joint=smoothstep(.018,.055,edge);float rnd=hash21(c);float n=noise2(p.xz*2.6)+.5*noise2(p.xz*8.3);vec3 slab=mix(vec3(.48,.35,.22),vec3(.66,.49,.30),rnd);slab*=.90+n*.12;return mix(vec3(.24,.18,.12),slab,joint);}
void main(){vec3 n=normalize(vNormal);vec3 lightDir=normalize(vec3(-.45,.86,.28));float nd=max(dot(n,lightDir),0.0);float hemi=.46+.34*(n.y*.5+.5);vec3 base;if(uMat==0)base=floorTex(vWorld);else if(uMat==4){float n2=noise2(vWorld.xz*2.0);base=mix(vec3(.34,.24,.15),vec3(.49,.35,.21),n2);}else base=stone(vWorld,n,uMat);float sun=.52+.65*nd;vec3 col=base*(hemi+sun*.47);float dist=distance(vWorld,uCam);float fog=smoothstep(34.0,78.0,dist);col=mix(col,uFog,fog*.84);outColor=vec4(col,1.0);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const loc={pos:gl.getAttribLocation(prog,'aPos'),normal:gl.getAttribLocation(prog,'aNormal'),model:gl.getUniformLocation(prog,'uModel'),view:gl.getUniformLocation(prog,'uView'),proj:gl.getUniformLocation(prog,'uProj'),cam:gl.getUniformLocation(prog,'uCam'),fog:gl.getUniformLocation(prog,'uFog'),mat:gl.getUniformLocation(prog,'uMat')};

function m4(){return new Float32Array(16)}
function ident(o){o.fill(0);o[0]=o[5]=o[10]=o[15]=1;return o}
function mul(out,a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let r0=0;r0<4;r0++)r[c*4+r0]=a[0*4+r0]*b[c*4+0]+a[1*4+r0]*b[c*4+1]+a[2*4+r0]*b[c*4+2]+a[3*4+r0]*b[c*4+3];out.set(r);return out}
function perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)*nf;out[11]=-1;out[14]=2*far*near*nf;return out}
function lookAt(out,e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out.set([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);return out}
function modelMat(x,y,z,sx,sy,sz,ry=0){const c=Math.cos(ry),s=Math.sin(ry);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1])}

function makeMesh(pos,norm,idx){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(norm),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:idx.length}}
function cubeMesh(){const p=[],n=[],idx=[];const faces=[[[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],[[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],[[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],[[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]];let b=0;for(const [nn,v] of faces){for(const q of v){p.push(...q);n.push(...nn)}idx.push(b,b+1,b+2,b,b+2,b+3);b+=4}return makeMesh(p,n,idx)}
const cube=cubeMesh();

const arena={rx:30.5,rz:21.2},pit={rx:9.2,rz:6.35,depth:1.6,stairOuter:13,stairInner:8,stairHalfWidth:2.7};
function inPit(x,z){return x*x/(pit.rx*pit.rx)+z*z/(pit.rz*pit.rz)<1}
function floorElevation(x,z){if(inPit(x,z))return-pit.depth;if(Math.abs(z)<pit.stairHalfWidth){const ax=Math.abs(x);if(ax<=pit.stairOuter&&ax>=pit.stairInner){const t=(pit.stairOuter-ax)/(pit.stairOuter-pit.stairInner);return-pit.depth*Math.max(0,Math.min(1,t))}}return 0}
function makeTerrain(){const step=1.15,p=[],n=[],idx=[];let base=0;for(let x=-31;x<31;x+=step)for(let z=-22;z<22;z+=step){const cx=x+step*.5,cz=z+step*.5;if(cx*cx/(arena.rx*arena.rx)+cz*cz/(arena.rz*arena.rz)>1)continue;const pts=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]];const ys=pts.map(q=>floorElevation(q[0],q[1]));for(let i=0;i<4;i++){p.push(pts[i][0],ys[i],pts[i][1]);n.push(0,1,0)}idx.push(base,base+2,base+1,base,base+3,base+2);base+=4}return makeMesh(p,n,idx)}
const terrain=makeTerrain();
const objects=[],colliders=[];
function box(x,z,w,d,h,mat=1,rot=0,base=0,collide=true){objects.push({mesh:cube,model:modelMat(x,base+h/2,z,w,h,d,rot),mat});if(collide)colliders.push({x,z,w,d,rot})}
for(let i=0;i<40;i++){const a=i/40*Math.PI*2,deg=(a*180/Math.PI+360)%360,gap=(deg<10||deg>350)||(deg>78&&deg<102)||(deg>168&&deg<192)||(deg>258&&deg<282);if(gap)continue;const h=2.8+((i*37)%5)*.16;box(Math.cos(a)*29,Math.sin(a)*19.8,3.4,1.7,h,1,a+Math.PI/2,0,true)}
for(let i=0;i<30;i++){const a=i/30*Math.PI*2,deg=(a*180/Math.PI+360)%360;if((deg<18||deg>342)||(deg>162&&deg<198))continue;box(Math.cos(a)*pit.rx,Math.sin(a)*pit.rz,2.05,1.0,2.0,3,a+Math.PI/2,-pit.depth,true)}
for(const side of [-1,1]){for(let i=0;i<8;i++){const t=i/7,x=side*(pit.stairOuter-(pit.stairOuter-pit.stairInner)*t),y=-pit.depth*t;box(x,0,.72,5.25,.14,2,0,y-.05,false)}}
function tPillar(x,z,rot=0,base=0){box(x,z,1.55,1.15,3.95,2,rot,base,true);box(x,z,3.15,.74,.78,2,rot,base+3.82,true)}
tPillar(0,-8.5);tPillar(0,8.5);tPillar(-10.8,-5.7,.45);tPillar(-10.8,5.7,-.45);tPillar(10.8,-5.7,-.45);tPillar(10.8,5.7,.45);
const covers=[[-22,-9,3.4,2,1.7],[-22,9,3.4,2,1.7],[-17,-14.8,3.8,1.8,1.45],[-17,14.8,3.8,1.8,1.45],[-10.5,-14,2.3,2.3,1.9],[-10.5,14,2.3,2.3,1.9]];for(const c of covers){box(...c,1);box(-c[0],c[1],c[2],c[3],c[4],1)}box(-18,0,4.8,1.35,1.35,1);box(18,0,4.8,1.35,1.35,1);box(0,-14.5,5,1.3,1.5,1);box(0,14.5,5,1.3,1.5,1);
for(let i=0;i<24;i++){const a=i*2.399,r=7+(i%5)*3.6,x=Math.cos(a)*r,z=Math.sin(a)*r*.67;if(x*x/(arena.rx*arena.rx)+z*z/(arena.rz*arena.rz)>.85)continue;box(x,z,.65+(i%3)*.38,.46,.18+(i%2)*.12,4,a,.02,false)}
// low-poly distant excavation mounds
for(let i=0;i<26;i++){const a=i/26*Math.PI*2,r=39+(i%4)*2.3;box(Math.cos(a)*r,Math.sin(a)*r*.72,5.8+(i%3)*2,4.2,1.2+(i%5)*.45,4,a,0,false)}

let px=-24.8,pz=0,yaw=0,pitch=0,locked=false;let vx=0,vz=0,jump=0,vy=0,onGround=true,bobPhase=0,bobAmount=0,mouseSwayX=0,mouseSwayY=0;let ammo=30,reserve=90,reload=0,round=90,last=performance.now();
const down={w:false,a:false,s:false,d:false,shift:false,ctrl:false,space:false};
function setKey(k,v){if(k in down){down[k]=v;if(keyEls[k])keyEls[k].classList.toggle('on',v)}}
function keyName(e){const c=e.code;if(c==='KeyW')return'w';if(c==='KeyA')return'a';if(c==='KeyS')return's';if(c==='KeyD')return'd';if(c.startsWith('Shift'))return'shift';if(c.startsWith('Control'))return'ctrl';if(c==='Space')return'space';return''}
function showMsg(t){shotmsg.textContent=t;shotmsg.classList.add('show');clearTimeout(showMsg.t);showMsg.t=setTimeout(()=>shotmsg.classList.remove('show'),800)}
function screenshot(){try{const a=document.createElement('a');a.download='gobeklitepe_v10.png';a.href=canvas.toDataURL('image/png');a.click();showMsg('F2 • GÖRÜNTÜ KAYDEDİLDİ')}catch(e){showMsg('GÖRÜNTÜ ALINAMADI')}}
function onKey(e,v){if(v&&!e.repeat&&e.code==='F2'){e.preventDefault();screenshot();return}if(v&&!e.repeat&&e.code==='KeyR'){if(reload<=0&&ammo<30&&reserve>0){reload=2.45;showMsg('ŞARJÖR DEĞİŞTİRİLİYOR')}return}const k=keyName(e);if(!k)return;if(v&&k==='space'&&!down.space&&onGround&&!down.ctrl){vy=6.15;onGround=false}setKey(k,v);e.preventDefault()}
document.addEventListener('keydown',e=>onKey(e,true),true);document.addEventListener('keyup',e=>onKey(e,false),true);window.addEventListener('blur',()=>Object.keys(down).forEach(k=>setKey(k,false)));
function lock(){canvas.focus({preventScroll:true});canvas.requestPointerLock()}
play.onclick=lock;canvas.onclick=()=>{if(!locked)lock()};document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;start.style.display=locked?'none':'flex';if(!locked)Object.keys(down).forEach(k=>setKey(k,false))});document.addEventListener('mousemove',e=>{if(!locked)return;const dx=e.movementX,dy=e.movementY;yaw+=dx*.00225;pitch=Math.max(-1.18,Math.min(1.05,pitch-dy*.00185));mouseSwayX=Math.max(-18,Math.min(18,mouseSwayX+dx*.07));mouseSwayY=Math.max(-12,Math.min(12,mouseSwayY+dy*.055))});
document.addEventListener('mousedown',e=>{if(!locked||e.button!==0)return;if(inPit(px,pz)){showMsg('BIÇAK');return}if(reload>0)return;if(ammo>0){ammo--;mouseSwayY-=2.6}else showMsg('ŞARJÖR BOŞ • R')});

function localRect(x,z,c){const co=Math.cos(-c.rot),si=Math.sin(-c.rot),dx=x-c.x,dz=z-c.z;return{x:dx*co-dz*si,z:dx*si+dz*co}}
function valid(x,z){if(x*x/((arena.rx-.55)**2)+z*z/((arena.rz-.55)**2)>=1)return false;for(const c of colliders){const p=localRect(x,z,c);if(Math.abs(p.x)<c.w/2+.42&&Math.abs(p.z)<c.d/2+.42)return false}return true}
function accelerate(dt){let ix=(down.d?1:0)-(down.a?1:0),iz=(down.w?1:0)-(down.s?1:0),len=Math.hypot(ix,iz);const walk=down.shift,crouch=down.ctrl;let max=walk?2.25:(crouch?1.7:5.55);if(down.s&&!down.w)max*=.72;const fwd=[Math.cos(yaw),Math.sin(yaw)],right=[-Math.sin(yaw),Math.cos(yaw)];let wx=0,wz=0;if(len){ix/=len;iz/=len;wx=right[0]*ix+fwd[0]*iz;wz=right[1]*ix+fwd[1]*iz;const wl=Math.hypot(wx,wz)||1;wx/=wl;wz/=wl}if(onGround){const sp=Math.hypot(vx,vz);if(!len&&sp>0){const drop=Math.min(sp,12.5*dt);vx*=Math.max(0,(sp-drop)/sp);vz*=Math.max(0,(sp-drop)/sp)}if(len){const current=vx*wx+vz*wz,add=max-current;if(add>0){const acc=Math.min(add,(down.a||down.d?24:19)*dt);vx+=wx*acc;vz+=wz*acc}const along=vx*wx+vz*wz;if(along<-.3){vx+=wx*18*dt;vz+=wz*18*dt}}}else if(len){const current=vx*wx+vz*wz,add=max-current;if(add>0){const acc=Math.min(add,2.8*dt);vx+=wx*acc;vz+=wz*acc}}
 const sp2=Math.hypot(vx,vz);if(sp2>max*1.08&&onGround){const k=(max*1.08)/sp2;vx*=k;vz*=k}}
function update(dt){accelerate(dt);let nx=px+vx*dt,nz=pz+vz*dt;if(valid(nx,pz))px=nx;else vx=0;if(valid(px,nz))pz=nz;else vz=0;if(!onGround){vy-=17.8*dt;jump+=vy*dt;if(jump<=0){jump=0;vy=0;onGround=true}}const sp=Math.hypot(vx,vz);if(onGround&&sp>.18){bobPhase+=dt*(6.4+sp*1.05);bobAmount+=(Math.min(1,sp/4)-bobAmount)*Math.min(1,dt*10)}else bobAmount+=(0-bobAmount)*Math.min(1,dt*10);mouseSwayX*=Math.pow(.001,dt);mouseSwayY*=Math.pow(.001,dt);if(reload>0){reload-=dt;if(reload<=0){const need=30-ammo,take=Math.min(need,reserve);ammo+=take;reserve-=take}}round-=dt;if(round<=0){round=90;px=-24.8;pz=0;vx=vz=0}const m=Math.floor(round/60),s=Math.floor(round%60);timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;ammoEl.textContent=`${ammo} / ${reserve}`;speedEl.textContent=`${sp.toFixed(1)} m/s`;stanceEl.textContent=inPit(px,pz)?'ER MEYDANI':down.ctrl?'ÇÖMEL':down.shift?'SESSİZ YÜRÜ':'KOŞU';hint.textContent=inPit(px,pz)?'ER MEYDANI • BIÇAK':'DIŞ KORİDOR';posEl.textContent=`X ${px.toFixed(1)} Z ${pz.toFixed(1)} • ${sp.toFixed(1)} m/s`;const lateral=Math.sin(bobPhase)*4.5*bobAmount,vertical=Math.abs(Math.cos(bobPhase))*5.5*bobAmount;const pitNow=inPit(px,pz);weapon.style.transform=`translate(${lateral+mouseSwayX}px,${vertical+mouseSwayY}px) rotate(${(-1.2*lateral/8-mouseSwayX*.06).toFixed(2)}deg)`;weapon.style.opacity=pitNow?'0':'0.98';knifeWeapon.style.opacity=pitNow?'0.98':'0';knifeWeapon.style.transform=`translate(${lateral*.75+mouseSwayX*.7}px,${vertical*.7+mouseSwayY*.7}px) rotate(${(-10-mouseSwayX*.08).toFixed(2)}deg)`}

function resize(){const d=Math.min(devicePixelRatio||1,1.6),w=Math.max(640,innerWidth),h=Math.max(360,innerHeight);canvas.width=Math.floor(w*d);canvas.height=Math.floor(h*d);canvas.style.width=w+'px';canvas.style.height=h+'px';gl.viewport(0,0,canvas.width,canvas.height)}addEventListener('resize',resize);resize();
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);
const view=m4(),proj=m4();
function drawMesh(mesh,model,mat){gl.uniformMatrix4fv(loc.model,false,model);gl.uniform1i(loc.mat,mat);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0)}
function render(){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const w=canvas.width,h=canvas.height,sp=Math.hypot(vx,vz);const fov=(75+Math.min(3.5,sp*.55))*Math.PI/180;perspective(proj,fov,w/h,.06,120);const floorY=floorElevation(px,pz),eye=down.ctrl?1.18:1.64;const bobY=Math.abs(Math.cos(bobPhase))*0.045*bobAmount,bobSide=Math.sin(bobPhase)*0.035*bobAmount;const right=[-Math.sin(yaw),Math.cos(yaw)];const ex=px+right[0]*bobSide,ez=pz+right[1]*bobSide,ey=floorY+eye+jump+bobY;const cp=Math.cos(pitch),dir=[Math.cos(yaw)*cp,Math.sin(pitch),Math.sin(yaw)*cp];lookAt(view,[ex,ey,ez],[ex+dir[0],ey+dir[1],ez+dir[2]],[0,1,0]);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.proj,false,proj);gl.uniform3f(loc.cam,ex,ey,ez);gl.uniform3f(loc.fog,.78,.67,.49);drawMesh(terrain,ident(m4()),0);for(const o of objects)drawMesh(o.mesh,o.model,o.mat)}
function loop(t){const dt=Math.min(.04,(t-last)/1000||.016);last=t;update(dt);render();requestAnimationFrame(loop)}requestAnimationFrame(loop);
})()

(()=>{
'use strict';
const canvas=document.getElementById('game');
const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
const $=id=>document.getElementById(id);
const start=$('start'),play=$('play'),err=$('err'),posEl=$('pos'),hint=$('hint'),speedEl=$('speed'),stanceEl=$('stance'),ammoEl=$('ammo'),timerEl=$('timer');
const weapon=$('weapon'),knifeWeapon=$('knifeWeapon'),shotmsg=$('shotmsg'),cross=$('cross'),debug=$('debug');
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
vec2 surfUV(vec3 p,vec3 n){vec3 an=abs(n);if(an.y>an.x&&an.y>an.z)return p.xz;if(an.x>an.z)return p.zy;return p.xy;}
float voronoiEdge(vec2 p,out vec2 cid){vec2 g=floor(p),f=fract(p);float d1=99.0,d2=99.0;vec2 best=vec2(0.0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 h=vec2(hash21(g+o),hash21(g+o+17.3));vec2 r=o+0.22+0.56*h-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;best=g+o;}else if(d<d2)d2=d;}cid=best;return sqrt(max(d2,0.0))-sqrt(max(d1,0.0));}
vec3 floorStone(vec3 p){vec2 warp=vec2(noise2(p.xz*.21),noise2(p.zx*.24+13.0))-.5;vec2 q=p.xz*.62+warp*.27;vec2 id;float edge=voronoiEdge(q,id);float cell=hash21(id);float grain=noise2(p.xz*2.5)+.42*noise2(p.xz*9.0);vec3 a=vec3(.52,.39,.25),b=vec3(.68,.51,.31);vec3 stone=mix(a,b,cell);stone*=.91+.11*grain;float mortar=smoothstep(.025,.105,edge);float hair=1.0-smoothstep(.015,.045,abs(noise2(p.xz*4.1+cell*13.0)-.52));stone*=1.0-.035*hair;return mix(vec3(.31,.235,.155),stone,mortar);}
vec3 wallStone(vec3 p,vec3 n,int mat){vec2 uv=surfUV(p,n);float sy=mat==3?.62:.72;float sx=mat==2?1.55:1.28;vec2 warped=uv+vec2((noise2(uv*.55)-.5)*.12,(noise2(uv*.7+9.0)-.5)*.055);vec2 q=vec2(warped.x/sx,warped.y/sy);float row=floor(q.y);q.x+=mod(row,2.0)*.47;vec2 c=floor(q),f=fract(q);float dx=min(f.x,1.0-f.x),dy=min(f.y,1.0-f.y);float joint=min(dx,dy);float edge=smoothstep(.028,.075,joint);float rnd=hash21(c+vec2(row,0));float grain=noise2(uv*2.9)+.5*noise2(uv*10.0);vec3 base=mat==3?vec3(.47,.35,.225):(mat==2?vec3(.67,.55,.36):vec3(.62,.49,.31));base*=.88+rnd*.17;base*=.91+grain*.09;float bevel=smoothstep(.04,.16,joint);base*=.90+.10*bevel;vec3 grout=mat==3?vec3(.27,.205,.14):vec3(.34,.275,.19);return mix(grout,base,edge);}
vec3 dirt(vec3 p){float n=noise2(p.xz*.42)+.5*noise2(p.xz*1.7)+.24*noise2(p.xz*6.0);return mix(vec3(.31,.23,.15),vec3(.50,.37,.23),clamp(n*.58,0.0,1.0));}
void main(){vec3 n=normalize(vNormal);vec3 ld=normalize(vec3(-.46,.84,.30));float nd=max(dot(n,ld),0.0);float hemi=.48+.28*(n.y*.5+.5);vec3 base;if(uMat==0)base=floorStone(vWorld);else if(uMat==4)base=dirt(vWorld);else base=wallStone(vWorld,n,uMat);float sun=.58+.62*nd;float contact=(uMat>0&&uMat<4)?smoothstep(-.12,.45,vWorld.y):1.0;vec3 col=base*(hemi+sun*.45)*mix(.72,1.0,contact);float dist=distance(vWorld,uCam);float fog=smoothstep(39.0,83.0,dist);col=mix(col,uFog,fog*.82);outColor=vec4(col,1.0);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const loc={pos:gl.getAttribLocation(prog,'aPos'),normal:gl.getAttribLocation(prog,'aNormal'),model:gl.getUniformLocation(prog,'uModel'),view:gl.getUniformLocation(prog,'uView'),proj:gl.getUniformLocation(prog,'uProj'),cam:gl.getUniformLocation(prog,'uCam'),fog:gl.getUniformLocation(prog,'uFog'),mat:gl.getUniformLocation(prog,'uMat')};

function m4(){return new Float32Array(16)}function ident(o){o.fill(0);o[0]=o[5]=o[10]=o[15]=1;return o}
function perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)*nf;out[11]=-1;out[14]=2*far*near*nf;return out}
function lookAt(out,e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;out.set([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);return out}
function modelMat(x,y,z,sx,sy,sz,ry=0){const c=Math.cos(ry),s=Math.sin(ry);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1])}
function makeMesh(pos,norm,idx){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(norm),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:idx.length}}
function cubeMesh(){const p=[],n=[],idx=[],faces=[[[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],[[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],[[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],[[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],[[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],[[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]];let b=0;for(const [nn,v] of faces){for(const q of v){p.push(...q);n.push(...nn)}idx.push(b,b+1,b+2,b,b+2,b+3);b+=4}return makeMesh(p,n,idx)}
function moundMesh(rx,rz,h,seg=18,rings=4){const p=[],n=[],idx=[];for(let r=0;r<=rings;r++){const t=r/rings,rr=t;for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,x=Math.cos(a)*rx*rr,z=Math.sin(a)*rz*rr,y=h*(1-rr*rr)-.38;p.push(x,y,z);const nx=x/(rx*rx),nz=z/(rz*rz),ny=1/(h||1);const l=Math.hypot(nx,ny,nz)||1;n.push(nx/l,ny/l,nz/l)}}for(let r=0;r<rings;r++)for(let i=0;i<seg;i++){const a=r*(seg+1)+i,b=a+seg+1;idx.push(a,b,a+1,a+1,b,b+1)}return makeMesh(p,n,idx)}
const cube=cubeMesh();

const arena={rx:30.5,rz:21.2},pit={rx:9.2,rz:6.35,depth:1.6,stairOuter:13,stairInner:8,stairHalfWidth:2.7};
function inPit(x,z){return x*x/(pit.rx*pit.rx)+z*z/(pit.rz*pit.rz)<1}
function floorElevation(x,z){if(inPit(x,z))return-pit.depth;if(Math.abs(z)<pit.stairHalfWidth){const ax=Math.abs(x);if(ax<=pit.stairOuter&&ax>=pit.stairInner){const t=(pit.stairOuter-ax)/(pit.stairOuter-pit.stairInner);return-pit.depth*Math.max(0,Math.min(1,t))}}return 0}
function makeTerrain(){const step=1.05,p=[],n=[],idx=[];let base=0;for(let x=-31;x<31;x+=step)for(let z=-22;z<22;z+=step){const cx=x+step*.5,cz=z+step*.5;if(cx*cx/(arena.rx*arena.rx)+cz*cz/(arena.rz*arena.rz)>1)continue;const pts=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]],ys=pts.map(q=>floorElevation(q[0],q[1]));for(let i=0;i<4;i++){p.push(pts[i][0],ys[i],pts[i][1]);n.push(0,1,0)}idx.push(base,base+2,base+1,base,base+3,base+2);base+=4}return makeMesh(p,n,idx)}
function makeOuterGround(){const step=3,p=[],n=[],idx=[];let b=0;for(let x=-60;x<60;x+=step)for(let z=-46;z<46;z+=step){const y=(Math.sin(x*.13)+Math.cos(z*.17)+Math.sin((x+z)*.09))*.08-.48;const yy=[y,y+.025*Math.sin(x),y+.025*Math.cos(z),y];const pts=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]];for(let i=0;i<4;i++){p.push(pts[i][0],yy[i],pts[i][1]);n.push(0,1,0)}idx.push(b,b+2,b+1,b,b+3,b+2);b+=4}return makeMesh(p,n,idx)}
const terrain=makeTerrain(),outerGround=makeOuterGround(),mound=moundMesh(1,1,1);
const objects=[],colliders=[];
function box(x,z,w,d,h,mat=1,rot=0,base=0,collide=true,stepable=true){objects.push({mesh:cube,model:modelMat(x,base+h/2,z,w,h,d,rot),mat});if(collide)colliders.push({x,z,w,d,rot,base,top:base+h,stepable})}
function addMound(x,z,rx,rz,h,rot=0){objects.push({mesh:mound,model:modelMat(x,0,z,rx,h,rz,rot),mat:4})}
// surrounding excavation instead of the old visual void
for(let i=0;i<20;i++){const a=i/20*Math.PI*2,r=43+(i%4)*3.0;addMound(Math.cos(a)*r,Math.sin(a)*r*.75,5.5+(i%3)*1.7,4.3+(i%4)*.9,1.4+(i%5)*.38,a)}
// outer oval wall: irregular heights + cap rubble
for(let i=0;i<44;i++){const a=i/44*Math.PI*2,deg=(a*180/Math.PI+360)%360;const gap=(deg<10||deg>350)||(deg>78&&deg<102)||(deg>168&&deg<192)||(deg>258&&deg<282);if(gap)continue;const h=2.35+((i*29)%7)*.13,w=2.65+((i*11)%4)*.18;const x=Math.cos(a)*29,z=Math.sin(a)*19.75;box(x,z,w,1.55,h,1,a+Math.PI/2,0,true,false);if(i%3===0)box(x+Math.cos(a)*.08,z+Math.sin(a)*.08,w*.52,1.25,.18,1,a+Math.PI/2,h-.02,false)}
// ancient inner pit ring, broken in places
for(let i=0;i<32;i++){const a=i/32*Math.PI*2,deg=(a*180/Math.PI+360)%360;if((deg<20||deg>340)||(deg>160&&deg<200)||(deg>82&&deg<98)||(deg>262&&deg<278))continue;const h=1.25+((i*17)%5)*.11;box(Math.cos(a)*pit.rx,Math.sin(a)*pit.rz,1.72,1.0,h,3,a+Math.PI/2,-pit.depth,true,false)}
// visual stair treads; movement follows the terrain ramp under them
for(const side of [-1,1])for(let i=0;i<9;i++){const t=i/8,x=side*(pit.stairOuter-(pit.stairOuter-pit.stairInner)*t),y=-pit.depth*t;box(x,0,.68,5.25,.10,2,0,y-.04,false)}
function tPillar(x,z,rot=0,base=0){box(x,z,1.35,1.02,3.7,2,rot,base,true,false);box(x,z,3.0,.72,.72,2,rot,base+3.55,true,false);box(x,z,1.55,1.18,.22,2,rot,base-.02,true,false)}
tPillar(0,-8.6);tPillar(0,8.6);tPillar(-10.8,-5.7,.45);tPillar(-10.8,5.7,-.45);tPillar(10.8,-5.7,-.45);tPillar(10.8,5.7,.45);
// combat covers now have climbable low stones, medium jump targets and a few tall blockers
const coverData=[
[-22,-9,3.4,2,.72,0.03],[-22,9,3.4,2,.72,-.04],[-17,-14.8,3.8,1.8,.96,.05],[-17,14.8,3.8,1.8,.96,-.03],
[-10.7,-14.1,2.4,2.4,.62,.06],[-10.7,14.1,2.4,2.4,.62,-.05],[-18,0,4.8,1.35,.82,0],[18,0,4.8,1.35,.82,0],
[0,-14.5,5,1.3,1.05,.03],[0,14.5,5,1.3,1.05,-.02],[-5.7,-11.2,2.1,1.7,.36,.06],[6.2,11.0,2.1,1.7,.36,-.05]
];
for(const [x,z,w,d,h,r] of coverData){box(x,z,w,d,h,1,r,0,true,true);if(x!==0)box(-x,z,w,d,h,1,-r,0,true,true)}
// low rubble remains non-solid
for(let i=0;i<34;i++){const a=i*2.399,r=6.8+(i%6)*3.4,x=Math.cos(a)*r,z=Math.sin(a)*r*.68;if(x*x/(arena.rx*arena.rx)+z*z/(arena.rz*arena.rz)>.83)continue;box(x,z,.38+(i%4)*.22,.34+(i%3)*.13,.10+(i%2)*.08,4,a,.02,false)}

// GoldSrc-scaled movement constants. 1 source unit ~= 0.02 m in this prototype.
const SCALE=.02,GRAVITY=800*SCALE,STEP_HEIGHT=18*SCALE,JUMP_HEIGHT=45*SCALE,JUMP_VEL=Math.sqrt(2*GRAVITY*JUMP_HEIGHT);
const FRICTION=4,STOP_SPEED=75*SCALE,GROUND_ACCEL=5,AIR_ACCEL=10,AK_MAX=221*SCALE,KNIFE_MAX=250*SCALE,WALK_FACTOR=.52,DUCK_FACTOR=.333;
const PLAYER_RADIUS=.34,STAND_H=1.78,DUCK_H=1.05,EYE_STAND=1.62,EYE_DUCK=1.02;
let px=-24.8,pz=0,py=floorElevation(-24.8,0),yaw=0,pitch=0,locked=false,vx=0,vz=0,vy=0,onGround=true,bobPhase=0,bobAmount=0,mouseSwayX=0,mouseSwayY=0,landKick=0;
let ammo=30,reserve=90,reload=0,round=90,last=performance.now(),attack=false,fireCooldown=0,recoilIndex=0,recoilReset=0,weaponKick=0,debugVisible=true,footstepClock=0;
const down={w:false,a:false,s:false,d:false,shift:false,ctrl:false,space:false};

// tiny procedural audio: enough to make movement feel grounded, no external files
let audio=null;function audioCtx(){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();return audio}
function noiseBurst(duration=.045,vol=.025,low=300,high=1600){try{const ac=audioCtx(),len=Math.max(1,(ac.sampleRate*duration)|0),buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();src.buffer=buf;f.type='bandpass';f.frequency.value=(low+high)/2;f.Q.value=.8;g.gain.value=vol;src.connect(f).connect(g).connect(ac.destination);src.start()}catch{}}
function tone(freq=90,dur=.07,vol=.05){try{const ac=audioCtx(),o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,ac.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.55),ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur)}catch{}}
function footstep(soft=false){noiseBurst(.035,soft?.008:.018,190,850);tone(soft?72:88,.035,soft?.008:.018)}
function gunshot(){noiseBurst(.075,.10,220,2400);tone(78,.065,.055)}

function setKey(k,v){if(k in down){down[k]=v;if(keyEls[k])keyEls[k].classList.toggle('on',v)}}
function keyName(e){const c=e.code;if(c==='KeyW')return'w';if(c==='KeyA')return'a';if(c==='KeyS')return's';if(c==='KeyD')return'd';if(c.startsWith('Shift'))return'shift';if(c.startsWith('Control'))return'ctrl';if(c==='Space')return'space';return''}
function showMsg(t){shotmsg.textContent=t;shotmsg.classList.add('show');clearTimeout(showMsg.t);showMsg.t=setTimeout(()=>shotmsg.classList.remove('show'),650)}
function screenshot(){try{const a=document.createElement('a');a.download='gobeklitepe_v11.png';a.href=canvas.toDataURL('image/png');a.click();showMsg('F2 • GÖRÜNTÜ KAYDEDİLDİ')}catch{showMsg('GÖRÜNTÜ ALINAMADI')}}
function doJump(){if(!onGround)return;const max=inPit(px,pz)?KNIFE_MAX:AK_MAX;const sp=Math.hypot(vx,vz),cap=max*1.7;if(sp>cap){const f=(cap/sp)*.65;vx*=f;vz*=f}vy=JUMP_VEL;onGround=false;footstep(true);landKick=0}
function onKey(e,v){if(v&&!e.repeat&&e.code==='F2'){e.preventDefault();screenshot();return}if(v&&!e.repeat&&e.code==='F3'){debugVisible=!debugVisible;debug.classList.toggle('hidden',!debugVisible);e.preventDefault();return}if(v&&!e.repeat&&e.code==='KeyR'){if(reload<=0&&ammo<30&&reserve>0){reload=2.45;showMsg('ŞARJÖR DEĞİŞTİRİLİYOR')}e.preventDefault();return}const k=keyName(e);if(!k)return;if(v&&k==='space'&&!down.space)doJump();setKey(k,v);e.preventDefault()}
document.addEventListener('keydown',e=>onKey(e,true),true);document.addEventListener('keyup',e=>onKey(e,false),true);window.addEventListener('blur',()=>{Object.keys(down).forEach(k=>setKey(k,false));attack=false});
function lock(){audioCtx();canvas.focus({preventScroll:true});canvas.requestPointerLock()}play.onclick=lock;canvas.onclick=()=>{if(!locked)lock()};document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;start.style.display=locked?'none':'flex';if(!locked){Object.keys(down).forEach(k=>setKey(k,false));attack=false}});
document.addEventListener('mousemove',e=>{if(!locked)return;const dx=e.movementX,dy=e.movementY;yaw+=dx*.00225;pitch=Math.max(-1.18,Math.min(1.05,pitch-dy*.00185));mouseSwayX=Math.max(-18,Math.min(18,mouseSwayX+dx*.055));mouseSwayY=Math.max(-12,Math.min(12,mouseSwayY+dy*.045))});
document.addEventListener('mousedown',e=>{if(!locked||e.button!==0)return;attack=true});document.addEventListener('mouseup',e=>{if(e.button===0)attack=false});

function localRect(x,z,c){const co=Math.cos(-c.rot),si=Math.sin(-c.rot),dx=x-c.x,dz=z-c.z;return{x:dx*co-dz*si,z:dx*si+dz*co}}
function insideCollider(x,z,c,margin=0){const p=localRect(x,z,c);return Math.abs(p.x)<c.w/2+margin&&Math.abs(p.z)<c.d/2+margin}
function supportHeightAt(x,z,maxTop=Infinity){let h=floorElevation(x,z);for(const c of colliders){if(c.top<=maxTop+.025&&insideCollider(x,z,c,-.06)&&c.top>h)h=c.top}return h}
function ceilingBlocked(x,z,feet,height){for(const c of colliders){if(!insideCollider(x,z,c,PLAYER_RADIUS*.8))continue;if(c.base<feet+height-.02&&c.top>feet+.03)return true}return false}
function bodyBlocked(x,z,feet,height,allowStep){let stepTo=null;for(const c of colliders){if(!insideCollider(x,z,c,PLAYER_RADIUS))continue;if(feet>=c.top-.025)continue;if(feet+height<=c.base+.025)continue;const dh=c.top-feet;if(allowStep&&onGround&&c.stepable&&dh>0&&dh<=STEP_HEIGHT+.01&&!ceilingBlocked(x,z,c.top,height)){stepTo=stepTo===null?c.top:Math.max(stepTo,c.top);continue}return{blocked:true,stepTo:null}}return{blocked:false,stepTo}}
function tryMove(nx,nz,height){if(nx*nx/((arena.rx-.48)**2)+nz*nz/((arena.rz-.48)**2)>=1)return false;const hit=bodyBlocked(nx,nz,py,height,true);if(hit.blocked)return false;px=nx;pz=nz;if(hit.stepTo!==null){py=hit.stepTo;vy=0;onGround=true}return true}

function friction(dt){const speed=Math.hypot(vx,vz);if(speed<.002){vx=vz=0;return}const control=Math.max(STOP_SPEED,speed),drop=control*FRICTION*dt,ns=Math.max(0,speed-drop),k=ns/speed;vx*=k;vz*=k}
function accel(dirx,dirz,wishspeed,accelRate,dt){const current=vx*dirx+vz*dirz,add=wishspeed-current;if(add<=0)return;let a=accelRate*dt*wishspeed;if(a>add)a=add;vx+=a*dirx;vz+=a*dirz}
function airAccel(dirx,dirz,wishspeed,dt){const wishspd=Math.min(wishspeed,30*SCALE),current=vx*dirx+vz*dirz,add=wishspd-current;if(add<=0)return;let a=AIR_ACCEL*wishspeed*dt;if(a>add)a=add;vx+=a*dirx;vz+=a*dirz}
function movement(dt){let sx=(down.d?1:0)-(down.a?1:0),fz=(down.w?1:0)-(down.s?1:0),len=Math.hypot(sx,fz);const inKnife=inPit(px,pz),weaponMax=inKnife?KNIFE_MAX:AK_MAX;let max=weaponMax;if(down.shift)max*=WALK_FACTOR;if(down.ctrl)max*=DUCK_FACTOR;const fwd=[Math.cos(yaw),Math.sin(yaw)],right=[-Math.sin(yaw),Math.cos(yaw)];let dx=0,dz=0;if(len){sx/=len;fz/=len;dx=right[0]*sx+fwd[0]*fz;dz=right[1]*sx+fwd[1]*fz;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl}
 if(onGround){friction(dt);if(len)accel(dx,dz,max,GROUND_ACCEL,dt)}else if(len)airAccel(dx,dz,max,dt);
 // no hard ground speed clamp; weapon max limits wish speed as in GoldSrc. Mega-bhop cap is applied on jump.
 const bodyH=down.ctrl?DUCK_H:STAND_H;let nx=px+vx*dt,nz=pz+vz*dt;if(!tryMove(nx,pz,bodyH))vx=0;if(!tryMove(px,nz,bodyH))vz=0;
}
function fire(){if(inPit(px,pz)){if(fireCooldown<=0){fireCooldown=.42;weaponKick=1;showMsg('BIÇAK');noiseBurst(.035,.025,300,1800)}return}if(reload>0||fireCooldown>0)return;if(ammo<=0){fireCooldown=.2;showMsg('ŞARJÖR BOŞ • R');return}ammo--;fireCooldown=.10;recoilIndex=Math.min(12,recoilIndex+1);recoilReset=.28;weaponKick=1;const kick=.0065+recoilIndex*.0007;pitch=Math.min(1.05,pitch+kick);yaw+=(recoilIndex%2?1:-1)*(.0012+recoilIndex*.00015);gunshot()}
function updateVertical(dt){const prevY=py;if(onGround){const support=supportHeightAt(px,pz,py+STEP_HEIGHT+.03);if(py-support>STEP_HEIGHT+.04){onGround=false;vy=0}else py=support}else{vy-=GRAVITY*dt;let ny=py+vy*dt;const crouchLift=down.ctrl?.18:0;const support=supportHeightAt(px,pz,prevY+crouchLift+.02);if(vy<=0&&ny<=support&&prevY+crouchLift>=support-.03){const impact=-vy;py=support;vy=0;onGround=true;landKick=Math.min(.10,impact*.012);if(impact>2.4){footstep(false);tone(62,.055,.02)}}else py=ny}}
function update(dt){movement(dt);updateVertical(dt);if(attack)fire();if(fireCooldown>0)fireCooldown-=dt;if(recoilReset>0){recoilReset-=dt}else recoilIndex=Math.max(0,recoilIndex-dt*18);if(reload>0){reload-=dt;if(reload<=0){const need=30-ammo,take=Math.min(need,reserve);ammo+=take;reserve-=take}}
 const sp=Math.hypot(vx,vz);if(onGround&&sp>.2){bobPhase+=dt*(6.0+sp*.88);bobAmount+=(Math.min(1,sp/(AK_MAX*.9))-bobAmount)*Math.min(1,dt*9);footstepClock-=dt;if(footstepClock<=0&&sp>2.65&&!down.ctrl){footstep(down.shift);footstepClock=down.shift?.52:.36}}else{bobAmount+=(0-bobAmount)*Math.min(1,dt*9);footstepClock=0}
 mouseSwayX*=Math.pow(.002,dt);mouseSwayY*=Math.pow(.002,dt);weaponKick*=Math.pow(.003,dt);landKick*=Math.pow(.01,dt);
 round-=dt;if(round<=0){round=90;px=-24.8;pz=0;py=floorElevation(px,pz);vx=vz=vy=0;onGround=true}const m=Math.floor(round/60),s=Math.floor(round%60);timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;ammoEl.textContent=`${ammo} | ${reserve}`;speedEl.textContent=`${sp.toFixed(1)} m/s`;stanceEl.textContent=inPit(px,pz)?'BIÇAK':down.ctrl?'ÇÖMEL':down.shift?'SESSİZ YÜRÜ':'KOŞU';hint.textContent=inPit(px,pz)?'ER MEYDANI • BIÇAK':'DIŞ KORİDOR';posEl.textContent=`X ${px.toFixed(1)} Z ${pz.toFixed(1)} Y ${py.toFixed(2)}`;
 const movingSpread=Math.min(8,sp*1.05)+(onGround?0:7)+(down.ctrl?-2:0)+recoilIndex*.75;cross.style.setProperty('--gap',`${Math.max(4,5+movingSpread*.28)}px`);
 const lat=Math.sin(bobPhase)*4.0*bobAmount,vert=Math.abs(Math.cos(bobPhase))*4.4*bobAmount+weaponKick*12+landKick*35;const pitNow=inPit(px,pz);weapon.style.transform=`translate(${lat+mouseSwayX*.55}px,${vert+mouseSwayY*.45}px) rotate(${(-2.2-lat*.10-mouseSwayX*.025+weaponKick*.8).toFixed(2)}deg)`;weapon.style.opacity=pitNow?'0':'0.98';knifeWeapon.style.opacity=pitNow?'0.98':'0';knifeWeapon.style.transform=`translate(${lat*.7+mouseSwayX*.45}px,${vert*.7+mouseSwayY*.4}px) rotate(${(-7-mouseSwayX*.03+weaponKick*3).toFixed(2)}deg)`}

function resize(){const d=Math.min(devicePixelRatio||1,1.55),w=Math.max(640,innerWidth),h=Math.max(360,innerHeight);canvas.width=Math.floor(w*d);canvas.height=Math.floor(h*d);canvas.style.width=w+'px';canvas.style.height=h+'px';gl.viewport(0,0,canvas.width,canvas.height)}addEventListener('resize',resize);resize();
gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);const view=m4(),proj=m4();
function drawMesh(mesh,model,mat){gl.uniformMatrix4fv(loc.model,false,model);gl.uniform1i(loc.mat,mat);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_INT,0)}
function render(){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const w=canvas.width,h=canvas.height,sp=Math.hypot(vx,vz);const fov=(74+Math.min(2.2,sp*.28))*Math.PI/180;perspective(proj,fov,w/h,.055,135);const eye=down.ctrl?EYE_DUCK:EYE_STAND;const bobY=(Math.abs(Math.cos(bobPhase))-.5)*.035*bobAmount-landKick*.6,bobSide=Math.sin(bobPhase)*.028*bobAmount;const right=[-Math.sin(yaw),Math.cos(yaw)],ex=px+right[0]*bobSide,ez=pz+right[1]*bobSide,ey=py+eye+bobY;const cp=Math.cos(pitch),dir=[Math.cos(yaw)*cp,Math.sin(pitch),Math.sin(yaw)*cp];lookAt(view,[ex,ey,ez],[ex+dir[0],ey+dir[1],ez+dir[2]],[0,1,0]);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.proj,false,proj);gl.uniform3f(loc.cam,ex,ey,ez);gl.uniform3f(loc.fog,.78,.68,.51);drawMesh(outerGround,ident(m4()),4);drawMesh(terrain,ident(m4()),0);for(const o of objects)drawMesh(o.mesh,o.model,o.mat)}
function loop(t){const dt=Math.min(.033,(t-last)/1000||.016);last=t;update(dt);render();requestAnimationFrame(loop)}requestAnimationFrame(loop);
})();

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb99869);
scene.fog=new THREE.Fog(0xb99869,55,120);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.1,250);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffe3b2,0x4a3d32,2.2));
const sun=new THREE.DirectionalLight(0xffdfab,2.6);sun.position.set(-28,42,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const matGround=new THREE.MeshStandardMaterial({color:0xa88356,roughness:1});
const matStone=new THREE.MeshStandardMaterial({color:0x806a52,roughness:.96});
const matStone2=new THREE.MeshStandardMaterial({color:0x6f5a45,roughness:.97});
const matDark=new THREE.MeshStandardMaterial({color:0x544334,roughness:1});
const matWood=new THREE.MeshStandardMaterial({color:0x6e4b2b,roughness:.9});
const matT=new THREE.MeshStandardMaterial({color:0x8a3627,roughness:.85});
const matCT=new THREE.MeshStandardMaterial({color:0x315f86,roughness:.85});
const floor=new THREE.Mesh(new THREE.CircleGeometry(50,96),matGround);floor.rotation.x=-Math.PI/2;floor.scale.set(1.25,.88,1);floor.receiveShadow=true;scene.add(floor);
// surrounding desert
const desert=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshStandardMaterial({color:0xc0a06f,roughness:1}));desert.rotation.x=-Math.PI/2;desert.position.y=-.03;scene.add(desert);
function box(x,y,z,sx,sy,sz,mat=matStone){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y+sy/2,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m;}
function pillar(x,z,h=4.2,w=1.4,mat=matStone){return box(x,0,z,w,h,w,mat)}
function ovalWall(rx,rz,segments=44,height=2.8,thick=1.25,gapAngles=[]){for(let i=0;i<segments;i++){const a=(i/segments)*Math.PI*2;const deg=(a*180/Math.PI+360)%360;if(gapAngles.some(([s,e])=>s<=e?(deg>=s&&deg<=e):(deg>=s||deg<=e)))continue;const x=Math.cos(a)*rx,z=Math.sin(a)*rz;const nx=Math.cos(a),nz=Math.sin(a);const tangent=new THREE.Vector3(-nz,0,nx);const arc=2*Math.PI*Math.sqrt((rx*rx+rz*rz)/2)/segments;const m=box(x,0,z,arc*1.04,height,thick,matStone2);m.rotation.y=Math.atan2(tangent.x,tangent.z);}}
ovalWall(36,25,56,3.2,1.4,[[170,190],[350,10]]);
ovalWall(24,16,44,2.2,1.0,[[165,195],[345,15],[80,100],[260,280]]);
// central ritual ring
ovalWall(11,7.5,30,1.25,.8,[[170,190],[350,10],[80,100],[260,280]]);
// T-shaped megaliths, simplified
function tPillar(x,z,rot=0,h=5){const stem=box(x,0,z,1.3,h,1.0,matStone);stem.rotation.y=rot;const cap=box(x,h-.55,z,3.3,1.0,1.15,matStone);cap.rotation.y=rot;}
tPillar(0,-1.5,0,5.8);tPillar(0,4.2,Math.PI,5.2);tPillar(-6,0,Math.PI/2,4.5);tPillar(6,0,-Math.PI/2,4.5);
// central low cover
box(0,0,0,4.2,1.2,2.8,matDark);
// lane cover, asymmetric enough to be interesting but balanced by mirroring
const covers=[[ -18,-11,3,1.5,2.2],[ -20,10,2.2,2.2,2.2],[-10,-18,4,1.4,1.8],[-8,17,2.4,2.4,2.4],[-27,-5,2.8,2.0,2.0],[-27,7,2.6,1.5,3.0]];
for(const c of covers){box(c[0],0,c[1],c[2],c[3],c[4],Math.random()>.5?matStone:matWood);box(-c[0],0,c[1],c[2],c[3],c[4],Math.random()>.5?matStone:matWood)}
// low curved-ish cover near middle exits
for(const s of [-1,1]){box(s*15,0,-4,4.5,1.3,1.5,matStone);box(s*15,0,5.5,3.5,1.8,1.4,matStone2)}
// spawn markers
box(-31.5,.02,0,4.0,.14,7.0,matT);box(31.5,.02,0,4.0,.14,7.0,matCT);
// torches / marker stones
for(let a=0;a<Math.PI*2;a+=Math.PI/6){const rx=30,rz=20;pillar(Math.cos(a)*rx,Math.sin(a)*rz,2.1,.65,matStone)}
// collision approximated by circles and boxes
const obstacles=[];
function addObs(x,z,r){obstacles.push({x,z,r})}
addObs(0,-1.5,2.2);addObs(0,4.2,2.2);addObs(-6,0,2);addObs(6,0,2);addObs(0,0,3.2);
for(const c of covers){addObs(c[0],c[1],Math.max(c[2],c[4])*.65);addObs(-c[0],c[1],Math.max(c[2],c[4])*.65)}
for(const s of [-1,1]){addObs(s*15,-4,2.7);addObs(s*15,5.5,2.4)}
let yaw=-Math.PI/2,pitch=0,locked=false;camera.position.set(-30,1.7,0);
const keys={};
addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
renderer.domElement.addEventListener('click',()=>{if(!locked)renderer.domElement.requestPointerLock()});
document.getElementById('play').onclick=()=>renderer.domElement.requestPointerLock();
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;document.getElementById('start').style.display=locked?'none':'flex'});
document.addEventListener('mousemove',e=>{if(!locked)return;yaw-=e.movementX*.00225;pitch-=e.movementY*.00225;pitch=Math.max(-1.45,Math.min(1.45,pitch));});
function validPos(x,z){const rx=34.5,rz=23.5;if((x*x)/(rx*rx)+(z*z)/(rz*rz)>1)return false;for(const o of obstacles){const dx=x-o.x,dz=z-o.z;if(dx*dx+dz*dz<(o.r+.42)*(o.r+.42))return false;}return true}
let last=performance.now();
function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;if(locked){const speed=(keys.ShiftLeft||keys.ShiftRight?8.5:5.3);let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),r=(keys.KeyD?1:0)-(keys.KeyA?1:0);const len=Math.hypot(f,r)||1;f/=len;r/=len;const sx=Math.sin(yaw),cx=Math.cos(yaw);const dx=(sx*f+cx*r)*speed*dt,dz=(-cx*f+sx*r)*speed*dt;const nx=camera.position.x+dx,nz=camera.position.z+dz;if(validPos(nx,camera.position.z))camera.position.x=nx;if(validPos(camera.position.x,nz))camera.position.z=nz;camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;document.getElementById('pos').textContent=`X ${camera.position.x.toFixed(1)}  Z ${camera.position.z.toFixed(1)}`;}renderer.render(scene,camera)}tick(performance.now());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

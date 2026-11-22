import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const $=s=>document.querySelector(s);
const form=$('form'), status=$('#status'), hud=$('#hud'), stick=$('#stick');
const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
const button=$('button');
status.textContent=invite?'옷 색상을 고른 뒤 입장하세요.':'행사 공용 QR로 접속해 주세요.';
button.disabled=!invite;
const adminPage=location.pathname==='/admin';
let ticket,isAdmin=false;
if(adminPage){
 document.querySelector('h1').textContent='관리자 입장';
 $('#nick').value='관리자';$('#nick').readOnly=true;
 const panel=document.createElement('section');
 panel.innerHTML='<button type="button" id="begin">GitHub 계정으로 인증</button><div hidden id="approval"><p>아래 코드를 복사한 뒤 GitHub에서 <b>Run workflow</b>를 눌러 입력하세요.</p><input type="text" id="code" aria-label="승인 코드" readonly><p><a target="_blank" rel="noopener noreferrer" href="https://github.com/zxtzxt30/dongnae-metaverse/actions/workflows/admin-entry.yml">GitHub 승인 화면 열기</a></p><button type="button" id="check">승인 확인</button></div>';
 form.insertBefore(panel,status);button.disabled=true;
 status.textContent='zxtzxt30 계정으로 승인해 주세요.';
 let proof;
 $('#begin').onclick=async()=>{
  try{const res=await fetch('/admin/begin',{method:'POST'});if(!res.ok)throw Error();
   const challenge=await res.json();proof=challenge.proof;$('#code').value=challenge.code;$('#approval').hidden=false;$('#begin').hidden=true;
  }catch{status.textContent='인증을 시작할 수 없습니다. 운영 시간을 확인해 주세요.'}
 };
 $('#code').onclick=e=>e.target.select();
 $('#check').onclick=async()=>{
  try{const res=await fetch('/admin/check',{method:'POST',headers:{Authorization:'Bearer '+proof}});
   if(res.status===202){status.textContent='승인 대기 중입니다. GitHub 승인 후 10초 뒤 다시 확인하세요.';return}
   if(!res.ok)throw Error();ticket=(await res.json()).ticket;
   panel.hidden=true;button.disabled=false;status.textContent='관리자 인증 완료 · 90초 안에 입장하세요.';
  }catch{status.textContent='인증을 확인할 수 없습니다. 다시 시도하거나 새로고침해 주세요.'}
 };
}
const roster=new Map();
let socket,myId,updateWorld=()=>{},ended=false;
function updateCount(){hud.textContent=isAdmin?'관리자 모드':(roster.size>1?'관리자 접속 중':'동네 산책')}
form.onsubmit=e=>{
 e.preventDefault();if(socket)return;
 ended=false;button.disabled=true;status.textContent='입장 확인 중…';
 socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/room');
 socket.onclose=({code})=>{
 ended=true;const message=({4001:'행사 QR을 다시 확인해 주세요.',4005:'관리자가 이미 접속 중입니다.',4003:'지금은 행사 운영 시간이 아닙니다.',4010:'3D 장면을 불러오지 못했습니다. 연결 상태를 확인하고 다시 접속해 주세요.',4004:'160명 정원이 찼습니다. 잠시 후 다시 시도해 주세요.'})[code]||'연결이 종료되었습니다.';
 form.hidden=false;stick.hidden=true;hud.hidden=true;status.textContent=message;button.disabled=false;button.textContent='다시 접속';form.onsubmit=e=>{e.preventDefault();location.reload()};
 document.querySelector('canvas')?.remove();
 };
 socket.onopen=()=>socket.send(JSON.stringify({type:'join',token:adminPage?undefined:invite,ticket,name:$('#nick').value,color:form.elements.color.value}));
 socket.onmessage=e=>{
 const m=JSON.parse(e.data);
 if(m.type==='welcome'){
  isAdmin=m.isAdmin===true;myId=m.id;for(const p of m.players)roster.set(p.id,p);
  status.textContent='동네를 불러오는 중…';start().catch(err=>{console.error(err);socket.close(4010,'render');});
 }else if(m.type==='enter')roster.set(m.player.id,m.player);
 else if(m.type==='leave')roster.delete(m.id);
 else if(m.type==='move'){for(const [id,x,z,a] of m.positions){const p=roster.get(id);if(p)Object.assign(p,{x,z,a})}}
 updateCount();updateWorld();
 };
};
async function start(){
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 document.body.prepend(renderer.domElement);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new T.Scene(), camera=new T.PerspectiveCamera(58,1,.08,600);
 scene.background=new T.Color(0xbad8df);scene.fog=new T.FogExp2(0xbad8df,.004);
 scene.add(new T.HemisphereLight(0xfff7eb,0xa7aaa0,2.1));
 const sun=new T.DirectionalLight(0xffefcd,2);sun.position.set(-30,75,42);scene.add(sun);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const viaTunnel=location.hostname.endsWith('.lhr.life');
 const model=viaTunnel
  ? 'https://raw.githubusercontent.com/zxtzxt30/dongnae-metaverse/ebb6dda6518592e48284ca56dd938f5faf8c9299/public/town.glb'
  : './town.glb';
 const gltf=await loader.loadAsync(model,event=>{
  if(ended)return;
  const total=event.total||44394120;
  const percent=Math.min(100,Math.floor(100*event.loaded/total));
  status.textContent=percent<100?'동네 다운로드 중 · '+percent+'%':'다운로드 완료 · 3D 장면을 준비하는 중…';
 });
 if(ended){renderer.dispose();renderer.domElement.remove();return}
 gltf.scene.traverse(object=>{
  if(!object.isMesh)return;
  for(const material of [].concat(object.material)){
   if(material.isMeshStandardMaterial)material.metalness=Math.min(material.metalness,.22);
  }
 });
 gltf.scene.position.y=1.56;scene.add(gltf.scene);
 const person=new T.Group();person.position.set(-65,0,55);scene.add(person);
 let mascotPromise;
 function loadMascot(){
  if(!mascotPromise){
   const url=viaTunnel?'https://raw.githubusercontent.com/zxtzxt30/dongnae-metaverse/d79f8f9325307dd6184b6809567b3f146100cabf/public/ci.glb':'/ci.glb';
   mascotPromise=loader.loadAsync(url).then(({scene:model})=>{
    const bounds=new T.Box3().setFromObject(model,true);
    const center=bounds.getCenter(new T.Vector3()),scale=1.85/(bounds.max.y-bounds.min.y);
    const wrapper=new T.Group();wrapper.add(model);wrapper.scale.setScalar(scale);
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
    return wrapper;
   }).catch(error=>{mascotPromise=undefined;throw error});
  }
  return mascotPromise;
 }
 let legs=[];
 if(isAdmin){
  status.textContent='관리자 아바타를 준비하는 중…';
  person.add((await loadMascot()).clone(true));
  if(ended){renderer.dispose();renderer.domElement.remove();return}
 }else{
 const cloth=new T.MeshStandardMaterial({color:'#198579'});
 function piece(geo,material,x,y,z){
  const mesh=new T.Mesh(geo,material.isMaterial?material:new T.MeshStandardMaterial({color:material}));
  mesh.position.set(x,y,z);person.add(mesh);return mesh;
 }
 const capsule=(r,l)=>new T.CapsuleGeometry(r,l,4,10);
 piece(capsule(.23,.32),cloth,0,1,0);
 piece(new T.SphereGeometry(.235,16,12),0xeab994,0,1.55,0);
 piece(new T.SphereGeometry(.245,16,12,0,Math.PI*2,0,1.42),0x413534,0,1.59,0);
 for(const side of [-1,1])piece(capsule(.075,.32),cloth,.28*side,.99,0);
 legs=[-1,1].map(s=>piece(capsule(.096,.43),0x303f52,.115*s,.311,0));
 cloth.color.set(form.elements.color.value);
 }
 const mine=roster.get(myId);person.position.set(mine.x,0,mine.z);
 const peers=new Map();
 function addPeer(p){
  const avatar=new T.Group();
  loadMascot().then(model=>{if(avatar.parent)avatar.add(model.clone(true))}).catch(error=>{
   console.error(error);hud.textContent='관리자 아바타를 불러오지 못했습니다. 새로고침해 주세요.';
  });
  const label=document.createElement('canvas');label.width=256;label.height=48;
  const ctx=label.getContext('2d');ctx.fillStyle='#123e39';ctx.fillRect(0,0,256,48);
  ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText(p.name,128,32,240);
  const texture=new T.CanvasTexture(label),tag=new T.Sprite(new T.SpriteMaterial({map:texture}));
  tag.scale.set(1.6,.3,1);tag.position.y=2;avatar.add(tag);scene.add(avatar);
  return {avatar,tag};
 }
 updateWorld=()=>{
  for(const [id,peer] of peers)if(!roster.has(id)){
   scene.remove(peer.avatar);peer.tag.material.map.dispose();peer.tag.material.dispose();peers.delete(id);
  }
  for(const [id,p] of roster)if(id!==myId&&!peers.has(id)){
   const peer=addPeer(p);peer.avatar.position.set(p.x,0,p.z);peers.set(id,peer);
  }
 };
 updateWorld();
 let playing=false,yaw=-1.85,pitch=.22,drag=null,joyId=null,jx=0,jy=0,step=0;
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
 resize();addEventListener('resize',resize);
 function view(){
  const focus=person.position.clone().add(new T.Vector3(0,1.2,0)),dist=playing?4.3:3.6;
  camera.position.copy(focus).add(new T.Vector3(dist*Math.sin(yaw)*Math.cos(pitch),dist*Math.sin(pitch),dist*Math.cos(yaw)*Math.cos(pitch)));
  camera.lookAt(focus);
 }
 const touch=matchMedia('(pointer:coarse)').matches;
 function resetStick(){jx=jy=0;joyId=null;$('#knob').style.transform=''}
 if(touch)stick.style.display='none';
 playing=true;form.hidden=true;hud.hidden=false;stick.hidden=!touch;if(touch)stick.style.display='block';updateCount();
 const walkSpeed=6.4; // World units per second at full keyboard or joystick input.
 const keys=new Set();onkeydown=e=>{if(playing)keys.add(e.code)};onkeyup=e=>keys.delete(e.code);
 onblur=()=>{keys.clear();resetStick();drag=null};
 const canvas=renderer.domElement;
 canvas.onpointerdown=e=>{if(drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};
 canvas.onpointermove=e=>{if(drag?.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.007;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.005,.04,1.25);drag.x=e.clientX;drag.y=e.clientY};
 canvas.onlostpointercapture=()=>drag=null;
 function joystick(e){const box=stick.getBoundingClientRect();let x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;const divisor=Math.max(32,Math.hypot(x,y));jx=x/divisor;jy=y/divisor;$('#knob').style.transform='translate('+jx*32+'px,'+jy*32+'px)'}
 stick.onpointerdown=e=>{if(joyId!==null)return;joyId=e.pointerId;stick.setPointerCapture(joyId);joystick(e)};
 stick.onpointermove=e=>{if(joyId===e.pointerId)joystick(e)};
 stick.onlostpointercapture=resetStick;
 let lastSend=0,dirty=false;
 let last=performance.now();
 renderer.setAnimationLoop(now=>{
 if(ended){renderer.setAnimationLoop(null);renderer.dispose();renderer.domElement.remove();return}
 const dt=Math.min(.05,(now-last)/1000);last=now;
 const x=jx+Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z=jy+Number(keys.has('KeyS'))-Number(keys.has('KeyW'));
 const speed=Math.hypot(x,z);
 if(playing&&speed){const dx=x*Math.cos(yaw)+z*Math.sin(yaw),dz=z*Math.cos(yaw)-x*Math.sin(yaw);
 person.position.x+=dx*walkSpeed*dt/Math.max(1,speed);person.position.z+=dz*walkSpeed*dt/Math.max(1,speed);person.rotation.y=Math.atan2(dx,dz);step+=dt*9;dirty=true}
 legs.forEach((leg,i)=>leg.rotation.x=speed?Math.sin(step+i*Math.PI)*.32:0);
 if(isAdmin&&dirty&&now-lastSend>=100&&socket.readyState===1){
  socket.send(JSON.stringify({type:'move',x:person.position.x,z:person.position.z,a:person.rotation.y}));lastSend=now;dirty=false;
 }
 for(const [id,{avatar}] of peers){
  const p=roster.get(id),alpha=1-Math.exp(-18*dt);
  avatar.position.x+=(p.x-avatar.position.x)*alpha;avatar.position.z+=(p.z-avatar.position.z)*alpha;avatar.rotation.y=p.a;
 }
 view();renderer.render(scene,camera);
 });
}









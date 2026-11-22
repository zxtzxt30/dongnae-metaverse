import http from 'node:http';
import {readFileSync,createReadStream,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';

const token=process.env.EVENT_TOKEN;
const start=Date.parse(process.env.EVENT_START), end=Date.parse(process.env.EVENT_END);
if(!token || token.length<16 || !(start<end)) throw Error('Set EVENT_TOKEN (16+ characters), EVENT_START and EVENT_END with timezone.');
const port=Number(process.env.PORT||3000);
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/walk.js',['walk.js','text/javascript']],['/town.glb',['town.glb','model/gltf-binary']]]);
const server=http.createServer((req,res)=>{
 const asset=assets.get(req.url.split('?')[0]);
 if(!asset || !['HEAD','GET'].includes(req.method)){res.writeHead(404).end();return}
 const path=fileURLToPath(new URL('./public/'+asset[0],import.meta.url));
 try{const size=statSync(path).size;res.writeHead(200,{'Content-Type':asset[1],'Content-Length':size});
 if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(503).end()}
});
const room=new WebSocketServer({noServer:true,maxPayload:1024,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/room'){socket.destroy();return}
 room.handleUpgrade(req,socket,head,ws=>room.emit('connection',ws));
});
const players=new Map(), changed=new Set();
const open=()=>Date.now()>=start && Date.now()<end;
function broadcast(data){const msg=JSON.stringify(data);for(const ws of players.keys())if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>524288)ws.terminate();else ws.send(msg)}}
room.on('connection',ws=>{
 const timer=setTimeout(()=>ws.close(4001,'invite'),8000);
 ws.alive=true;ws.on('pong',()=>ws.alive=true);
 ws.on('error',()=>ws.terminate());
 ws.on('close',()=>{clearTimeout(timer);const p=players.get(ws);if(p){players.delete(ws);changed.delete(p);broadcast({type:'leave',id:p.id})}});
 let lastMove=0;
 ws.on('message',raw=>{
 if(ws.readyState!==WebSocket.OPEN)return;
 if(!open()){ws.close(4003,'closed');return}
 let m;try{m=JSON.parse(raw)}catch{ws.close(4002,'invalid');return}
 if(!m||typeof m!=='object'){ws.close(4002,'invalid');return}
 const p=players.get(ws);
 if(!p){
 if(m.type!=='join'||m.token!==token){ws.close(4001,'invite');return}
 if(players.size>=160){ws.close(4004,'full');return}
 clearTimeout(timer);
 const slot=Array.from({length:160},(_,i)=>i).find(i=>![...players.values()].some(p=>p.slot===i));
 const user={id:randomUUID(),slot,name:String(m.name||'산책자').slice(0,12),color:['#198579','#e87650','#9274cd'].includes(m.color)?m.color:'#198579',x:-65+slot%8*.78,z:55+Math.floor(slot/8)*.78,a:0};
 broadcast({type:'enter',player:user});players.set(ws,user);
 ws.send(JSON.stringify({type:'welcome',id:user.id,players:[...players.values()]}));return;
 }
 if(m.type==='move'&&Date.now()-lastMove>=65&&[m.x,m.z,m.a].every(n=>Number.isFinite(n)&&Math.abs(n)<10000)){
 lastMove=Date.now();Object.assign(p,{x:m.x,z:m.z,a:m.a});changed.add(p);
 }
 });
});
setInterval(()=>{
 if(!open()){for(const ws of players.keys())if(ws.readyState===1)ws.close(4003,'closed');changed.clear();return}
 if(changed.size){broadcast({type:'move',positions:[...changed].map(p=>[p.id,p.x,p.z,p.a])});changed.clear()}
},100);
setInterval(()=>{for(const ws of room.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},25000);
server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log('Listening on port',server.address().port));

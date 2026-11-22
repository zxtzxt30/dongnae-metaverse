import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';
test('shared room, admission, movement, departure and scheduled close',async t=>{
 const token='a-local-test-invitation', stop=Date.now()+8000;
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',EVENT_TOKEN:token,EVENT_START:new Date(Date.now()-60000).toISOString(),EVENT_END:new Date(stop).toISOString()}});
 const sockets=[];t.after(()=>{for(const s of sockets)s.terminate();child.kill()});
 const [line]=await once(child.stdout,'data'),port=Number(String(line).trim().split(' ').at(-1));
 function connect(key=token){
  const s=new WebSocket('ws://127.0.0.1:'+port+'/room');sockets.push(s);
  s.once('open',()=>s.send(JSON.stringify({type:'join',token:key,name:'tester'})));return s;
 }
 function message(s,type){return new Promise(resolve=>{function read(data){const m=JSON.parse(data);if(m.type===type){s.off('message',read);resolve(m)}}s.on('message',read)})}
 assert.equal((await once(connect('wrong'),'close'))[0],4001);
 const first=connect();await message(first,'welcome');
 const second=connect();const welcome=await message(second,'welcome');assert.equal(welcome.players.length,2);
 const batch=await Promise.all(Array.from({length:158},()=>message(connect(),'welcome')));
 assert.equal(Math.max(...batch.map(m=>m.players.length)),160);
 assert.equal((await once(connect(),'close'))[0],4004);
 const moving=message(first,'move');second.send(JSON.stringify({type:'move',x:-65,z:52,a:1}));assert.deepEqual((await moving).positions[0],[welcome.id,-65,52,1]);
 const left=message(first,'leave');second.close();assert.equal((await left).id,welcome.id);
 await message(connect(),'welcome');
 const closes=await Promise.all(sockets.filter(s=>s.readyState===1).map(s=>once(s,'close')));
 assert.equal(closes.length,160);assert.ok(closes.every(([code])=>code===4003));
 assert.equal((await once(connect(),'close'))[0],4003);
});

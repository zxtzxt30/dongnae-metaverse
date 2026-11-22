import {randomBytes} from 'node:crypto';
const runsUrl='https://api.github.com/repos/zxtzxt30/dongnae-metaverse/actions/workflows/admin-entry.yml/runs?event=workflow_dispatch&branch=main&per_page=30';
const ownerId=62588748;
const secret=()=>randomBytes(32).toString('hex');
export function createAdminEntry(fetchRuns=async()=>{
 const res=await fetch(runsUrl,{headers:{Accept:'application/vnd.github+json','User-Agent':'Dongnae-event'},signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error('GitHub unavailable');
 return (await res.json()).workflow_runs;
}){
 const pending=new Map(),tickets=new Map();
 let recent,refreshAt=0;
 function clean(map){for(const [key,value] of map)if(value.expires<=Date.now())map.delete(key)}
 return {
  begin(){
   clean(pending);if(pending.size>=256)return null;
   const proof=secret(),code=randomBytes(12).toString('hex');
   pending.set(proof,{code,expires:Date.now()+600000});
   return {proof,code};
  },
  async claim(proof){
   const challenge=pending.get(proof);
   if(!challenge||challenge.expires<=Date.now())return {status:410};
   if(Date.now()>=refreshAt){recent=fetchRuns();refreshAt=Date.now()+10000}
   const runs=await recent;
   if(!runs.some(run=>run.actor?.id===ownerId&&run.event==='workflow_dispatch'&&run.head_branch==='main'&&run.display_title==='Dongnae admin '+challenge.code))return {status:202};
   if(challenge.expires<=Date.now()||!pending.delete(proof))return {status:410};
   clean(tickets);const ticket=secret();tickets.set(ticket,{expires:Date.now()+90000});return {status:200,ticket};
  },
  consume(ticket){const grant=tickets.get(ticket);tickets.delete(ticket);return Boolean(grant&&grant.expires>Date.now())}
 };
}

import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';

const ref='refs/heads/live-endpoint';
const remote='https://github.com/zxtzxt30/dongnae-metaverse.git';
const git=(args,input)=>execFileSync('git',args,{input,encoding:'utf8',windowsHide:true,timeout:20000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}}).trim();
function publish(origin,end){
 const blob=git(['hash-object','-w','--stdin'],JSON.stringify({origin,end})+'\n');
 const tree=git(['mktree'],'100644 blob '+blob+'\tendpoint.json\n');
 const previous=git(['ls-remote',remote,ref]).split(/\s/)[0];
 if(previous){
  git(['fetch','--quiet','--no-tags',remote,ref]);
  if(git(['rev-parse','FETCH_HEAD^{tree}'])===tree)return;
 }
 const parent=previous?['-p','FETCH_HEAD']:[];
 const commit=git(['commit-tree',tree,...parent,'-m','Update current event relay']);
 git(['push','--quiet',remote,commit+':'+ref]);
}
async function runMobileRelay(port,end){
 const until=Date.parse(end);
 while(Date.now()<until){
  const ssh=spawn('ssh',['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3','-o','ExitOnForwardFailure=yes','-R','80:127.0.0.1:'+port,'nokey@localhost.run'],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  const stop=()=>{ssh.kill();process.exit(0)};process.once('disconnect',stop);
  let current='',published='';
  const closed=new Promise(resolve=>{ssh.once('error',resolve);ssh.once('close',resolve)});
  const lines=createInterface({input:ssh.stdout});
  lines.on('line',line=>{
   const match=/tunneled with tls termination, (https:\/\/[a-z0-9]+\.app\.lhr\.life)\b/.exec(line);
   if(match)current=match[1];
  });
  let running=true;closed.then(()=>running=false);
  while(running&&Date.now()<until){
   if(current&&published!==current){
    try{publish(current,end);published=current}catch{console.warn('Retrying mobile entrance publication')}
   }
   await Promise.race([closed,delay(3000)]);
  }
  lines.close();ssh.kill();await delay(3000);process.off('disconnect',stop);
 }
}

await runMobileRelay(process.argv[2],process.argv[3]);

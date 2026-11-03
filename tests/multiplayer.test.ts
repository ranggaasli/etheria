import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {Client,type Room} from '@colyseus/sdk';
import type {Snapshot} from '../shared/content.js';
const path=join(mkdtempSync(join(tmpdir(),'etheria-multi-')),'game.sqlite');const port=3100+Math.floor(Math.random()*200),url='http://127.0.0.1:'+port;
async function start(){const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',SERVE_BUILD:'1',AUTH_MODE:'local',DATABASE_URL:'',PORT:String(port),PUBLIC_URL:url,SQLITE_PATH:path},stdio:['ignore','pipe','pipe','ipc']});let log='';child.stdout!.on('data',b=>{log+=String(b);});child.stderr!.on('data',b=>{log+=String(b);});for(let n=0;n<150;n++){if(child.exitCode!==null)throw Error(log);try{const r=await fetch(url+'/health');if(r.ok)return child;}catch{/* Waiting for startup. */}await pause(100);}child.kill();throw Error('Server did not start: '+log);}
async function stop(child:ChildProcess){const end=new Promise<void>(r=>child.once('exit',()=>r()));child.send('shutdown');await Promise.race([end,pause(8000).then(()=>{child.kill();})]);}
async function post(route:string,body:unknown,cookie=''){const r=await fetch(url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:url},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
async function session(cookie:string){return (await fetch(url+'/api/auth/session',{headers:{Cookie:cookie}})).json();}
async function until(check:()=>boolean,timeout=5000){const end=Date.now()+timeout;while(!check()){if(Date.now()>end)throw Error('Timed out waiting for multiplayer state');await pause(50);}}
async function attach(cookie:string){const ticket=(await post('ticket',{},cookie)).data.ticket;const r=await new Client(url.replace('http','ws')).join('realm',{ticket});const state:{snapshot:Snapshot|null;notices:string[];chat:any[]}={snapshot:null,notices:[],chat:[]};r.onMessage('snapshot',s=>{state.snapshot=s;});r.onMessage('notice',m=>state.notices.push(m));r.onMessage('chat',m=>state.chat.push(m));r.onMessage('effect',()=>{});await until(()=>!!state.snapshot);return {room:r,state};}
async function walk(r:Room,state:{snapshot:Snapshot|null},x:number,y:number){const deadline=Date.now()+15000;while(Math.hypot(state.snapshot!.me.x-x,state.snapshot!.me.y-y)>17){if(Date.now()>deadline)throw Error(`Cannot reach ${x},${y} from ${state.snapshot!.me.x},${state.snapshot!.me.y}`);const c=state.snapshot!.me,dx=x-c.x,dy=y-c.y,d=Math.hypot(dx,dy);r.send('input',{x:dx/d,y:dy/d});await pause(60);}r.send('input',{x:0,y:0});await pause(120);}
test('real accounts, 2 WebSocket players, movement, chat, guild, parties, isolated dungeons and restart persistence',{timeout:120000},async()=>{
  let server=await start();let a:Awaited<ReturnType<typeof attach>>|undefined,b:Awaited<ReturnType<typeof attach>>|undefined;
  try{
    assert.equal((await post('ticket',{})).status,401);assert.equal((await post('auth/register',{email:'bad',password:'short'})).status,400);
    const one=await post('auth/register',{email:'one@example.invalid',password:'test-secret-123'}),two=await post('auth/register',{email:'two@example.invalid',password:'test-secret-123'});assert.equal(one.status,200);assert.equal(two.status,200);
    const appearance={hair:1,hairColor:'#554433',skin:'#ddbbaa',eyes:1,outfit:'#668877'};
    await post('character',{name:'DawnOne',classId:'Knight',appearance},one.cookie);await post('character',{name:'DawnTwo',classId:'Mage',appearance},two.cookie);
    assert.equal((await post('auth/login',{email:'one@example.invalid',password:'bad-password'})).status,400);
    a=await attach(one.cookie);b=await attach(two.cookie);await until(()=>a!.state.snapshot!.players.length===2&&b!.state.snapshot!.players.length===2);
    const oldX=a.state.snapshot!.me.x;a.room.send('input',{x:100000,y:0});await pause(200);assert.equal(a.state.snapshot!.me.x,oldX);
    await walk(a.room,a.state,865,690);await until(()=>b!.state.snapshot!.players.some(p=>p.name==='DawnOne'&&p.x>840));
    a.room.send('chat','Salam <b>Etheria</b>!');await until(()=>b!.state.chat.length>0);assert.equal(b.state.chat[0].text,'Salam bEtheria/b!');
    a.room.send('action',{type:'trade',verb:'buy',id:'potion'});await until(()=>a!.state.notices.some(n=>n.includes('Dekati')));assert.equal(a.state.snapshot!.me.gold,40);
    await walk(a.room,a.state,850,560);await walk(a.room,a.state,1080,570);a.room.send('action',{type:'guildCreate',name:'Dawn Keepers'});await until(()=>!!a!.state.snapshot!.social.guild);
    a.room.send('action',{type:'guildInvite',id:b.state.snapshot!.me.id});await until(()=>b!.state.snapshot!.social.invites.some(i=>i.kind==='guild'));const invitation=b.state.snapshot!.social.invites.find(i=>i.kind==='guild')!;b.room.send('action',{type:'guildAccept',id:invitation.id});await until(()=>!!b!.state.snapshot!.social.guild);
    a.room.send('action',{type:'partyInvite',id:b.state.snapshot!.me.id});await until(()=>b!.state.snapshot!.social.invites.some(i=>i.kind==='party'));b.room.send('action',{type:'partyAccept',id:b.state.snapshot!.social.invites.find(i=>i.kind==='party')!.id});await until(()=>a!.state.snapshot!.social.party?.members.length===2);
    a.room.send('action',{type:'partyLeave'});await until(()=>!a!.state.snapshot!.social.party);b.room.send('action',{type:'partyLeave'});await until(()=>!b!.state.snapshot!.social.party);
    // Both players reach the real portal through server-validated movement.
    for(const p of [a,b]){await walk(p.room,p.state,p.state.snapshot!.me.x,480);await walk(p.room,p.state,1210,480);await walk(p.room,p.state,1210,240);p.room.send('action',{type:'travel',to:'crypt'});await until(()=>p.state.snapshot!.me.zone==='crypt');}
    assert.notEqual(a.state.snapshot!.instance,b.state.snapshot!.instance);assert.equal(a.state.snapshot!.players.length,1);assert.equal(b.state.snapshot!.players.length,1);assert.notEqual(a.state.snapshot!.enemies[0],b.state.snapshot!.enemies[0]);
    a.room.send('action',{type:'chest'});await until(()=>a!.state.notices.some(n=>n.includes('Kalahkan seluruh')));assert.equal(a.state.snapshot!.me.gold,40);
    for(const p of [a,b]){await walk(p.room,p.state,160,1030);p.room.send('action',{type:'travel',to:'village'});await until(()=>p.state.snapshot!.me.zone==='village');}
    a.room.send('action',{type:'partyInvite',id:b.state.snapshot!.me.id});await until(()=>b!.state.snapshot!.social.invites.some(i=>i.kind==='party'));b.room.send('action',{type:'partyAccept',id:b.state.snapshot!.social.invites.find(i=>i.kind==='party')!.id});await until(()=>a!.state.snapshot!.social.party?.members.length===2);
    for(const p of [a,b]){await walk(p.room,p.state,850,480);await walk(p.room,p.state,1210,480);await walk(p.room,p.state,1210,240);}
    a.room.send('action',{type:'travel',to:'crypt'});await until(()=>a!.state.snapshot!.me.zone==='crypt'&&b!.state.snapshot!.me.zone==='crypt');assert.equal(a.state.snapshot!.instance,b.state.snapshot!.instance);assert.equal(a.state.snapshot!.players.length,2);
    await walk(a.room,a.state,330,930);a.room.send('attack',1);await until(()=>b!.state.snapshot!.enemies.some(e=>e.hp<e.maxHp));
    await a.room.leave();await b.room.leave();a=undefined;b=undefined;await pause(300);await stop(server);server=await start();
    const re=await post('auth/login',{email:'one@example.invalid',password:'test-secret-123'});assert.equal(re.status,200);const saved=await session(re.cookie);assert.equal(saved.character.name,'DawnOne');assert.equal(saved.character.appearance.hair,1);assert.equal(saved.character.inventory.wheat_seed,4);assert(saved.character.guildId);
    const outstanding=await post('ticket',{},re.cookie);const loggedOut=await post('auth/logout',{},re.cookie);assert.equal(loggedOut.status,200);assert.equal((await session(re.cookie)).user,null);assert.equal((await post('ticket',{},re.cookie)).status,401);await assert.rejects(new Client(url.replace('http','ws')).join('realm',{ticket:outstanding.data.ticket}));await assert.rejects(new Client(url.replace('http','ws')).create('realm',{ticket:'invalid'}));
  }finally{await a?.room.leave();await b?.room.leave();await stop(server);}
});

import { Room, type Client } from '@colyseus/core';
import { schema,t } from '@colyseus/schema';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { distance,maxHp,blocked,NPCS,type Character,type Enemy,type Social,type Snapshot,type Zone } from '../shared/content.js';
import { Store } from './store.js';
import { add,attack,ensure,farm,instanceId,lineOfSight,move,near,place,quest,spawnEnemies,trade,transition } from './rules.js';

const WorldState=schema({tick:t.number().default(0),online:t.number().default(0)},'WorldState');
interface Actor {client:Client;c:Character;input:{x:number;y:number;at:number};facing:number;emote:string;emoteUntil:number;last:number[];busy:boolean;instance:string;guild:Social['guild'];muted:Set<string>;rates:Record<string,number[]>}
interface Party {id:string;leader:string;members:string[]}
interface Invite {kind:'guild'|'party';from:string;name:string;id:string;at:number}
const actionSchema=z.object({type:z.enum(['travel','farm','trade','quest','clue','gather','equip','potion','place','upgrade','chest','guildCreate','guildInvite','guildAccept','guildLeave','partyInvite','partyAccept','partyLeave','emote','mute','report']),to:z.enum(['village','forest','farm','house','crypt']).optional(),verb:z.string().max(24).optional(),index:z.number().int().optional(),crop:z.enum(['wheat','carrot','potato','moonflower']).optional(),id:z.string().max(80).optional(),name:z.string().max(80).optional(),x:z.number().int().optional(),y:z.number().int().optional()});
export const tickets=new Map<string,{userId:string;sessionHash:string;expires:number}>();
export let realm:Realm|undefined;
export class Realm extends Room<{state:InstanceType<typeof WorldState>}> {
  state=new WorldState();maxClients=8;autoDispose=false;
  actors=new Map<string,Actor>();parties=new Map<string,Party>();invites=new Map<string,Invite[]>();
  forest=spawnEnemies();dungeons=new Map<string,{enemies:Enemy[];created:number}>();
  private queue:Promise<unknown>=Promise.resolve();
  static store:Store;
  onCreate(){
    ensure(!realm,'Satu dunia bersama sudah berjalan. Gunakan join.');
    realm=this; // eslint-disable-line @typescript-eslint/no-this-alias
    this.onMessage('input',(client,data)=>{const a=this.actors.get(client.sessionId);if(!a||!this.rate(a,'input',35,1000))return;const v=z.object({x:z.number().finite().min(-1).max(1),y:z.number().finite().min(-1).max(1)}).safeParse(data);if(v.success)a.input={...v.data,at:Date.now()};});
    this.onMessage('action',(client,data)=>{const a=this.actors.get(client.sessionId);if(!a||!this.rate(a,'action',12,1000))return;const v=actionSchema.safeParse(data);if(!v.success)return this.error(client,'Permintaan tidak valid.');this.enqueue(()=>this.action(a,v.data));});
    this.onMessage('attack',(client,data)=>{const a=this.actors.get(client.sessionId);if(!a||!this.rate(a,'attack',8,1000))return;const v=z.number().int().min(0).max(2).safeParse(data);if(v.success)this.enqueue(()=>this.combat(a,v.data));});
    this.onMessage('chat',(client,data)=>{const a=this.actors.get(client.sessionId);if(!a||!this.rate(a,'chat',4,5000)||typeof data!=='string')return;const message=Array.from(data).filter(c=>c!=='<'&&c!=='>'&&c.charCodeAt(0)>=32).join('').trim().slice(0,180);if(!message)return;for(const peer of this.actors.values())if(!peer.muted.has(a.c.id))peer.client.send('chat',{id:a.c.id,name:a.c.name,text:message,time:Date.now()});});
    this.setSimulationInterval(dt=>this.tick(dt/1000),50);
    this.clock.setInterval(()=>this.snapshot(),100);
    this.clock.setInterval(()=>this.enqueue(async()=>{for(const a of this.actors.values())await this.persist(a);}),15000);
  }
  enqueue(fn:()=>Promise<unknown>){this.queue=this.queue.then(fn).catch(e=>console.error('Realm operation failed',e instanceof Error?e.message:'unknown'));}
  rate(a:Actor,key:string,max:number,window:number){const now=Date.now(),r=(a.rates[key]||[]).filter(t=>now-t<window);if(r.length>=max)return false;r.push(now);a.rates[key]=r;return true;}
  async onAuth(_client:Client,options:Record<string,unknown>){const key=typeof options.ticket==='string'?options.ticket:'';const ticket=tickets.get(key);tickets.delete(key);ensure(ticket&&ticket.expires>Date.now(),'Sesi tidak berlaku. Muat ulang halaman.');const session=await Realm.store.query('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?',[ticket.sessionHash,Date.now()]);ensure(session[0]?.user_id===ticket.userId,'Sesi telah berakhir. Silakan masuk lagi.');return ticket.userId;}
  async onJoin(client:Client,_options:unknown,auth:string){
    ensure(![...this.actors.values()].some(a=>a.c.userId===auth),'Karakter sudah terhubung di tab lain.');
    // Lock the user before asynchronous database work to avoid duplicate joins.
    ensure(!joining.has(auth),'Karakter sedang terhubung.');joining.add(auth);
    try{const c=await Realm.store.character(auth);ensure(c,'Buat karakter terlebih dahulu.');if(c.zone==='crypt'){c.zone='village';c.x=800;c.y=690;}
      c.hp=Math.max(1,c.hp);const a:Actor={client,c,input:{x:0,y:0,at:0},facing:0,emote:'',emoteUntil:0,last:c.cooldowns||[0,0,0],busy:false,instance:c.zone==='farm'||c.zone==='house'?c.id:'shared',guild:await Realm.store.guild(c),muted:new Set(),rates:{}};
      this.actors.set(client.sessionId,a);this.state.online=this.actors.size;client.send('notice','Selamat datang di Eldermere. Dekati Tetua Aruna dan tekan E.');
    }finally{joining.delete(auth);}
  }
  async onLeave(client:Client){const a=this.actors.get(client.sessionId);if(!a)return;await this.queue;await this.persist(a);this.leaveParty(a);this.actors.delete(client.sessionId);this.state.online=this.actors.size;}
  async onDispose(){await this.queue;for(const a of this.actors.values())await this.persist(a);}
  async persist(a:Actor){if(a.busy)return;await Realm.store.save(a.c);}
  error(client:Client,message:string){client.send('notice',message);}
  byCharacter(id:string){return [...this.actors.values()].find(a=>a.c.id===id||a.c.name.toLowerCase()===id.toLowerCase());}
  party(a:Actor){return [...this.parties.values()].find(p=>p.members.includes(a.c.id));}
  leaveParty(a:Actor){const p=this.party(a);if(!p)return;p.members=p.members.filter(id=>id!==a.c.id);if(!p.members.length)this.parties.delete(p.id);else if(p.leader===a.c.id)p.leader=p.members[0];}
  enemies(a:Actor){return a.c.zone==='forest'?this.forest:a.c.zone==='crypt'?this.dungeons.get(a.instance)?.enemies||[]:[];}
  async mutate(a:Actor,fn:(c:Character)=>void,completion?:string){
    a.busy=true;try{const c=structuredClone(a.c);fn(c);await Realm.store.transaction(async q=>{
      if(completion)await q('INSERT INTO dungeon_completions(character_id,instance_id,rewarded_at) VALUES(?,?,?)',[c.id,completion,Date.now()]);await Realm.store.saveIn(q,c);
    });a.c=c;}finally{a.busy=false;}
  }
  async combat(a:Actor,skill:number){
    try{ensure(a.c.zone==='forest'||a.c.zone==='crypt'||skill===2,'Tidak ada pertempuran di desa.');const enemies=structuredClone(this.enemies(a));let effect:ReturnType<typeof attack>|undefined;
      await this.mutate(a,c=>{const now=Date.now();effect=attack(c,enemies,skill,now,a.last[skill]);c.cooldowns=[...a.last];c.cooldowns[skill]=now;});a.last=a.c.cooldowns!;
      if(a.c.zone==='forest')this.forest=enemies;else if(a.c.zone==='crypt')this.dungeons.get(a.instance)!.enemies=enemies;
      for(const peer of this.actors.values())if(peer.c.zone===a.c.zone&&peer.instance===a.instance)peer.client.send('effect',{x:effect?.target?.x||a.c.x,y:effect?.target?.y||a.c.y,damage:effect?.damage||0,skill,classId:a.c.classId});
    }catch(e){this.error(a.client,(e as Error).message);}
  }
  async refreshGuilds(){for(const a of this.actors.values()){a.guild=await Realm.store.guild(a.c);a.c.guildId=a.guild?.id||null;}}
  async action(a:Actor,v:z.infer<typeof actionSchema>){
    try{
      if(v.type==='emote'){a.emote=['☀','♡','!','♪'].includes(v.id||'')?v.id!:'♡';a.emoteUntil=Date.now()+3500;return;}
      if(v.type==='mute'){ensure(v.id,'Pilih pemain.');if(a.muted.has(v.id))a.muted.delete(v.id);else a.muted.add(v.id);this.error(a.client,'Pengaturan bisu diperbarui.');return;}
      if(v.type==='report'){ensure(v.id&&v.name,'Isi alasan laporan.');await Realm.store.query('INSERT INTO reports(id,reporter,target,reason,created_at) VALUES(?,?,?,?,?)',[randomUUID(),a.c.userId,v.id,v.name.slice(0,80),Date.now()]);this.error(a.client,'Laporan tersimpan untuk ditinjau pengelola.');return;}
      if(v.type==='guildCreate'){ensure(a.c.zone==='village','Kunjungi Mira di desa.');near(a.c,NPCS[2],170);await Realm.store.createGuild(a.c,(v.name||'').trim());await this.refreshGuilds();return;}
      if(v.type==='guildLeave'){await Realm.store.leaveGuild(a.c);await this.refreshGuilds();return;}
      if(v.type==='partyLeave'){ensure(a.c.zone!=='crypt','Keluar dari dungeon sebelum meninggalkan party.');this.leaveParty(a);return;}
      if(v.type==='guildInvite'||v.type==='partyInvite'){
        const target=this.byCharacter(v.id||'');ensure(target&&target!==a,'Pemain tidak ditemukan.');let id:string;
        if(v.type==='guildInvite'){ensure(a.guild?.leader===a.c.id,'Hanya pemimpin guild dapat mengundang.');ensure(!target.guild,'Pemain sudah memiliki guild.');id=a.guild.id;}
        else{ensure(a.c.zone!=='crypt'&&target.c.zone!=='crypt','Undang pemain di luar dungeon.');let p=this.party(a);if(!p){p={id:randomUUID(),leader:a.c.id,members:[a.c.id]};this.parties.set(p.id,p);}ensure(p.leader===a.c.id&&p.members.length<4,'Party penuh atau kamu bukan pemimpin.');ensure(!this.party(target),'Pemain sudah memiliki party.');id=p.id;}
        const list=(this.invites.get(target.c.id)||[]).filter(i=>i.at>Date.now()-120000);ensure(list.length<8,'Terlalu banyak undangan.');
        list.push({kind:v.type==='guildInvite'?'guild':'party',from:a.c.id,name:a.c.name,id,at:Date.now()});this.invites.set(target.c.id,list);return;
      }
      if(v.type==='guildAccept'||v.type==='partyAccept'){
        const kind=v.type==='guildAccept'?'guild':'party';const list=this.invites.get(a.c.id)||[];const i=list.find(i=>i.id===v.id&&i.kind===kind&&i.at>Date.now()-120000);ensure(i,'Undangan kedaluwarsa.');
        if(kind==='guild'){await Realm.store.joinGuild(a.c,i.id,i.from);await this.refreshGuilds();}
        else{const p=this.parties.get(i.id);ensure(p&&p.members.length<4&&!this.party(a),'Party tidak tersedia.');ensure(a.c.zone!=='crypt'&&!p.members.some(id=>this.byCharacter(id)?.c.zone==='crypt'),'Party sedang bertualang di dungeon.');p.members.push(a.c.id);}
        this.invites.set(a.c.id,list.filter(inv=>inv!==i));return;
      }
      if(v.type==='travel'&&v.to==='crypt'){
        ensure(a.c.zone==='village','Portal crypt berada di desa.');const p=this.party(a);ensure(!p||p.leader===a.c.id,'Pemimpin party membuka portal.');
        const members=p?p.members.map(id=>this.byCharacter(id)):[a];ensure(members.every(Boolean),'Semua anggota harus terhubung.');
        for(const m of members){ensure(m!.c.zone==='village','Semua anggota harus di desa.');near(m!.c,{x:1180,y:220},185);}
        const id=instanceId();const copies=members.map(m=>{const c=structuredClone(m!.c);transition(c,'crypt');return {a:m!,c};});
        await Realm.store.transaction(async q=>{for(const pair of copies)await Realm.store.saveIn(q,pair.c);});
        this.dungeons.set(id,{enemies:spawnEnemies(true),created:Date.now()});for(const pair of copies){pair.a.c=pair.c;pair.a.instance=id;pair.a.input={x:0,y:0,at:0};}return;
      }
      await this.mutate(a,c=>{
        switch(v.type){
          case 'travel':ensure(v.to,'Pilih tujuan.');transition(c,v.to);break;
          case 'farm':farm(c,v.verb||'',v.index??-1,v.crop);break;
          case 'trade':trade(c,v.verb||'',v.id||'');break;
          case 'quest':quest(c,v.verb||'');break;
          case 'clue':ensure(c.zone==='forest','Altar berada di hutan.');near(c,{x:1370,y:300},160);ensure(c.accepted&&c.quest===3,'Terima misi Jejak Kristal dahulu.');c.clue=true;break;
          case 'gather':ensure(c.zone==='forest','Daun embun tumbuh di hutan.');near(c,{x:350,y:720},160);ensure(Date.now()-(c.lastGatherAt||0)>=20000,'Daun baru tumbuh setelah 20 detik.');add(c,'herb',1);c.lastGatherAt=Date.now();break;
          case 'equip':ensure(v.id&&ITEMS_SAFE_SLOT(v.id),'Item tidak dapat dipakai.');ensure((c.inventory[v.id]||0)>0,'Kamu tidak memiliki item ini.');c.equipment[ITEMS_SAFE_SLOT(v.id)!]=v.id;break;
          case 'potion':add(c,'potion',-1);c.hp=Math.min(maxHp(c),c.hp+55);break;
          case 'place':place(c,v.id||'',v.x??-1,v.y??-1);break;
          case 'upgrade':ensure(c.zone==='farm'&&c.farmLevel<2&&c.gold>=60,'Peningkatan kebun perlu 60 emas (maksimal level 2).');c.gold-=60;c.farmLevel++;break;
          case 'chest':ensure(c.zone==='crypt'&&this.enemies(a).every(e=>e.hp===0),'Kalahkan seluruh penjaga crypt.');near(c,{x:1380,y:180},170);c.gold+=80;add(c,'crystal_blade',1);c.completed=[...new Set([...c.completed,'crypt'])];break;
          default:throw Error('Interaksi tidak dikenal.');
        }
      },v.type==='chest'?a.instance:undefined);
      if(v.type==='travel'){a.instance=a.c.zone==='farm'||a.c.zone==='house'?a.c.id:'shared';a.input={x:0,y:0,at:0};}
      if(v.type==='clue')this.error(a.client,'“Kami menyembunyikan jantungnya dari mahkota.” Tulisan ini mengubah segalanya.');
      if(v.type==='chest')this.error(a.client,'Pusaka Penjaga diperoleh. Kembali ke Aruna untuk mengungkap rahasia.');
    }catch(e){const message=(e as Error).message;this.error(a.client,/unique|constraint/i.test(message)?'Nama sudah digunakan, undangan tidak berlaku, atau hadiah sudah diambil.':message);}
  }
  tick(dt:number){
    const now=Date.now();this.state.tick++;
    for(const a of this.actors.values()){
      if(a.busy)continue;if(now-a.input.at<250){move(a.c,a.input.x,a.input.y,dt);if(a.input.x||a.input.y)a.facing=Math.atan2(a.input.y,a.input.x);}
      if(now>a.emoteUntil)a.emote='';
    }
    const groups=[{zone:'forest' as Zone,id:'shared',enemies:this.forest},...[...this.dungeons].map(([id,d])=>({zone:'crypt' as Zone,id,enemies:d.enemies}))];
    for(const group of groups)for(const e of group.enemies){
      if(e.hp<=0){if(group.zone==='forest'&&now-e.deadAt>25000){e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;}continue;}
      const targets=[...this.actors.values()].filter(a=>!a.busy&&a.c.zone===group.zone&&a.instance===group.id).sort((a,b)=>distance(a.c,e)-distance(b.c,e));const target=targets[0];
      const dest=target&&distance(target.c,e)<(e.kind==='boss'?390:260)?target.c:{x:e.homeX,y:e.homeY};
      const d=distance(e,dest);if(d>42){const step=(e.kind==='boss'?70:82)*Math.min(dt,0.075),x=e.x+(dest.x-e.x)/d*step,y=e.y+(dest.y-e.y)/d*step;if(!blocked(group.zone,x,e.y))e.x=x;if(!blocked(group.zone,e.x,y))e.y=y;}
      if(target&&distance(e,target.c)<62&&now-e.lastAttack>1250&&lineOfSight(group.zone,e,target.c)){
        target.c.hp=Math.max(0,target.c.hp-e.damage);e.lastAttack=now;target.client.send('effect',{x:target.c.x,y:target.c.y,damage:e.damage,hurt:true});
        if(target.c.hp<=0){target.c.hp=maxHp(target.c);target.c.zone='village';target.c.x=800;target.c.y=690;target.instance='shared';target.input={x:0,y:0,at:0};this.error(target.client,'Cahaya Eldermere membawamu pulang. Kemajuanmu aman.');}
      }
    }
    for(const [id,d]of this.dungeons)if(now-d.created>60000&&![...this.actors.values()].some(a=>a.instance===id))this.dungeons.delete(id);
    for(const [id,t]of tickets)if(t.expires<now)tickets.delete(id);
  }
  snapshot(){
    for(const a of this.actors.values()){
      const p=this.party(a);const data:Snapshot={me:a.c,players:[...this.actors.values()].filter(b=>b.c.zone===a.c.zone&&b.instance===a.instance).map(b=>({id:b.c.id,name:b.c.name,classId:b.c.classId,appearance:b.c.appearance,x:b.c.x,y:b.c.y,hp:b.c.hp,maxHp:maxHp(b.c),level:b.c.level,guild:b.guild?.name||'',emote:b.emote,facing:b.facing})),enemies:this.enemies(a),social:{guild:a.guild,party:p?{id:p.id,leader:p.leader,members:p.members.map(id=>{const b=this.byCharacter(id);return {id,name:b?.c.name||'Terputus',hp:b?.c.hp||0,maxHp:b?maxHp(b.c):100};})}:null,invites:(this.invites.get(a.c.id)||[]).filter(i=>i.at>Date.now()-120000)},instance:a.instance,chest:a.c.zone==='crypt'&&this.enemies(a).every(e=>e.hp===0),time:Date.now(),online:this.actors.size};
      a.client.send('snapshot',data);
    }
  }
}
const joining=new Set<string>();
import { ITEMS } from '../shared/content.js';
const ITEMS_SAFE_SLOT=(id:string)=>ITEMS[id]?.slot;

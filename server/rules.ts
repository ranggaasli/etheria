import { randomUUID } from 'node:crypto';
import { CROPS,ITEMS,QUESTS,CLASSES,blocked,cropReady,distance,maxHp,plotPosition,NPCS,PORTALS,type Character,type CropId,type Enemy,type Zone } from '../shared/content.js';
export function ensure(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message);}
export function add(c:Character,id:string,n:number){ensure(ITEMS[id],'Item tidak dikenal.');const next=(c.inventory[id]||0)+n;ensure(Number.isInteger(next)&&next>=0&&next<=9999,'Jumlah item tidak valid.');if(next)c.inventory[id]=next;else{delete c.inventory[id];for(const slot of Object.keys(c.equipment))if(c.equipment[slot]===id)delete c.equipment[slot];}}
export function xp(c:Character,n:number){c.xp+=n;while(c.xp>=c.level*80){c.xp-=c.level*80;c.level++;c.hp=maxHp(c);}}
export function move(c:Character,dx:number,dy:number,dt:number){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const length=Math.hypot(dx,dy);if(!length)return;
  const step=185*Math.min(dt,0.075);const x=c.x+dx/length*step,y=c.y+dy/length*step;
  if(!blocked(c.zone,x,c.y))c.x=x;if(!blocked(c.zone,c.x,y))c.y=y;
}
export function near(c:Character,p:{x:number;y:number},radius=145){ensure(distance(c,p)<=radius,'Dekati objek untuk berinteraksi.');}
export function transition(c:Character,to:Zone){
  const portal=PORTALS[c.zone].find(p=>p.to===to);ensure(portal,'Jalur tidak tersedia.');near(c,portal,155);
  const from=c.zone;c.zone=to;c.x=800;c.y=690;
  if(to==='forest'){c.x=180;c.y=650;}if(to==='farm'){c.x=800;c.y=1000;}if(to==='house'){c.x=800;c.y=900;}
  if(to==='village'&&from==='forest'){c.x=1330;c.y=650;}
  if(to==='crypt'){c.x=250;c.y=1000;}
}
export function farm(c:Character,action:string,index:number,crop:CropId='wheat',now=Date.now()){
  ensure(c.zone==='farm','Kunjungi kebun pribadimu.');ensure(Number.isInteger(index)&&index>=0&&index<8+c.farmLevel*4,'Petak tidak tersedia.');near(c,plotPosition(index),160);
  const key=String(index),p=c.plots[key];
  if(action==='plant'){ensure(!p,'Petak sudah ditanami.');ensure(CROPS[crop],'Benih tidak dikenal.');add(c,crop+'_seed',-1);c.plots[key]={crop,plantedAt:now,watered:false};if(c.accepted&&c.quest===1)c.completed=[...new Set([...c.completed,'planted'])];}
  else if(action==='water'){ensure(p,'Tanam benih terlebih dahulu.');p.watered=true;}
  else if(action==='harvest'){ensure(p&&cropReady(p,now),'Tanaman belum matang atau belum disiram.');add(c,p.crop,2);delete c.plots[key];xp(c,8);}
  else throw Error('Interaksi kebun tidak dikenal.');
}
export function trade(c:Character,side:string,id:string){
  ensure(c.zone==='village','Pedagang berada di Eldermere.');near(c,NPCS[1],165);
  const item=ITEMS[id];ensure(item,'Item tidak dikenal.');
  if(side==='buy'){ensure(id.endsWith('_seed')||id==='potion'||id==='tunic','Item tidak dijual.');ensure(c.gold>=item.price,'Emas tidak cukup.');add(c,id,1);c.gold-=item.price;}
  else{ensure(!id.endsWith('_seed'),'Pedagang tidak membeli benih.');add(c,id,-1);c.gold+=item.price;}
}
export const furnitureSize=(kind:string)=>kind==='bed'?{w:130,h:150}:kind==='table'?{w:140,h:100}:{w:70,h:70};
export function place(c:Character,id:string,x:number,y:number){
  ensure(c.zone==='house'&&c.houseOwned,'Masuk rumahmu terlebih dahulu.');ensure(Number.isInteger(x)&&Number.isInteger(y),'Posisi tidak valid.');
  const f=c.furniture.find(f=>f.id===id);ensure(f,'Furnitur tidak ditemukan.');
  const size=furnitureSize(f.kind);ensure(x>=280&&x<=1300&&y>=280&&y<=850,'Tempatkan furnitur di dalam ruangan.');
  ensure(!c.furniture.some(o=>{if(o.id===id)return false;const s=furnitureSize(o.kind);return Math.abs(o.x-x)<(size.w+s.w)/2+10&&Math.abs(o.y-y)<(size.h+s.h)/2+10;}),'Furnitur saling bertumpuk.');f.x=x;f.y=y;
}
export function quest(c:Character,action:string){
  ensure(c.quest<QUESTS.length,'Bab pertama telah selesai.');
  const npc=c.quest===4?NPCS[2]:NPCS[0];ensure(c.zone==='village','Temui pemberi misi di desa.');near(c,npc,170);
  if(action==='accept'){c.accepted=true;return;}
  ensure(c.accepted,'Terima misi terlebih dahulu.');
  const ready=[true,c.completed.includes('planted'),c.kills>=3,c.clue,true,c.completed.includes('crypt')][c.quest];ensure(ready,'Tujuan misi belum selesai.');
  c.gold+=QUESTS[c.quest].reward;xp(c,25+c.quest*10);c.quest++;c.accepted=false;
}
export function lineOfSight(zone:Zone,a:{x:number;y:number},b:{x:number;y:number}){const d=distance(a,b);for(let i=15;i<d;i+=15)if(blocked(zone,a.x+(b.x-a.x)*i/d,a.y+(b.y-a.y)*i/d))return false;return true;}
export function attack(c:Character,enemies:Enemy[],skill:number,now:number,last:number){
  ensure(Number.isInteger(skill)&&skill>=0&&skill<=2,'Compétence tidak valid.');const cls=CLASSES[c.classId];ensure(now-last>=cls.cooldown[skill],'Kemampuan belum siap.');
  if(skill===2){c.hp=Math.min(maxHp(c),c.hp+45);return {target:null,damage:0};}
  const targets=enemies.filter(e=>e.hp>0&&distance(c,e)<=cls.range[skill]&&lineOfSight(c.zone,c,e)).sort((a,b)=>distance(c,a)-distance(c,b));ensure(targets.length,'Tidak ada musuh dalam jangkauan.');
  let primary:Enemy|null=null;let dealt=0;
  for(const e of targets.slice(0,skill===1?5:1)){const damage=cls.damage[skill]+(c.level-1)*3+(c.equipment.weapon?5:0);e.hp=Math.max(0,e.hp-damage);primary=e;dealt=damage;
    if(e.hp===0){e.deadAt=now;xp(c,e.kind==='boss'?100:e.kind==='elite'?35:18);c.gold+=e.kind==='boss'?35:6;add(c,e.kind==='slime'?'herb':'shard',1);if(c.zone==='forest')c.kills++;}
  }return {target:primary,damage:dealt};
}
export function spawnEnemies(crypt=false):Enemy[]{
  return (crypt?[['wisp',280,680],['slime',350,860],['elite',780,290],['boss',1330,240]]:[['slime',360,480],['wisp',740,260],['slime',740,900],['elite',1200,560],['wisp',1230,920]]).map(([kind,x,y],i)=>{
    const k=String(kind),hp=k==='boss'?340:k==='elite'?120:k==='wisp'?55:65;
    return {id:(crypt?'crypt':'forest')+i,kind:k,name:k==='boss'?'Penjaga Sumpah':k==='elite'?'Rusa Retak':k==='wisp'?'Arwah Lumut':'Embun Liar',x:Number(x),y:Number(y),hp,maxHp:hp,damage:k==='boss'?17:k==='elite'?12:6,homeX:Number(x),homeY:Number(y),lastAttack:0,deadAt:0};
  });
}
export const instanceId=()=>randomUUID();

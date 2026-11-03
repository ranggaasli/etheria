export const LOCATIONS = {village:'Eldermere Village', forest:'Whispering Forest', farm:'Tanah Harapan', house:'Rumah Pengembara', crypt:'Forgotten Crypt'} as const;
export type Zone = keyof typeof LOCATIONS;
export type ClassId = 'Knight'|'Mage'|'Ranger';
export const CLASSES = {
  Knight:{color:'#e9b967',description:'Penjaga garis depan. Tebasan kuat dan pemulihan.',skills:['Tebasan','Putaran Baja','Tekad Penjaga'],damage:[16,29,0],range:[85,125,0],cooldown:[550,2800,6500]},
  Mage:{color:'#a99bef',description:'Perapal kristal. Serangan jarak jauh dan cahaya pemulih.',skills:['Percikan','Nova Kristal','Cahaya Pulih'],damage:[13,33,0],range:[270,200,0],cooldown:[700,3200,7000]},
  Ranger:{color:'#86cba4',description:'Pemburu hutan. Panah cepat dan hujan anak panah.',skills:['Panah','Hujan Panah','Napas Hutan'],damage:[12,24,0],range:[320,250,0],cooldown:[450,2400,6000]}
} as const;
export const CROPS = {wheat:{name:'Gandum',icon:'🌾',seconds:45,price:3,sell:9},carrot:{name:'Wortel',icon:'🥕',seconds:70,price:5,sell:14},potato:{name:'Kentang',icon:'🥔',seconds:90,price:7,sell:19},moonflower:{name:'Moonflower',icon:'✿',seconds:120,price:12,sell:34}} as const;
export type CropId = keyof typeof CROPS;
export const ITEMS:Record<string,{name:string;icon:string;rarity:string;price:number;slot?:string}> = {
  ...Object.fromEntries(Object.entries(CROPS).flatMap(([id,c])=>[[id,{name:c.name,icon:c.icon,rarity:'common',price:c.sell}],[id+'_seed',{name:'Benih '+c.name,icon:'❧',rarity:'common',price:c.price}]])),
  herb:{name:'Daun Embun',icon:'❧',rarity:'common',price:4},shard:{name:'Serpih Kristal',icon:'◈',rarity:'rare',price:15},potion:{name:'Ramuan Pulih',icon:'⚗',rarity:'common',price:10},
  crystal_blade:{name:'Pusaka Penjaga',icon:'⚔',rarity:'epic',price:100,slot:'weapon'},tunic:{name:'Jubah Eldermere',icon:'♜',rarity:'uncommon',price:25,slot:'body'}
};
export const QUESTS = [
  {name:'Pengembara Baru',objective:'Temui Tetua Aruna di alun-alun.',dialogue:'Selamat datang di Eldermere, Pengembara. Tujuh kristal pernah menyatukan Aetheria. Sejak Keretakan Agung, bahkan hutan mulai melupakan namanya. Maukah kau membantu kami?',reward:20},
  {name:'Tanah Harapan',objective:'Tanam benih pertama di kebun pribadimu.',dialogue:'Tanah ini milikmu sekarang. Ambil benih ini. Harapan tidak tumbuh dari pedang saja; terkadang ia dimulai dari satu biji kecil.',reward:25},
  {name:'Bisikan Hutan',objective:'Kalahkan 3 makhluk di Whispering Forest.',dialogue:'Makhluk hutan bukan musuh kita dahulu. Sesuatu memanggil mereka dari reruntuhan. Cari tahu apa yang mengusik tidur mereka.',reward:35},
  {name:'Jejak Kristal',objective:'Periksa altar kristal di timur hutan.',dialogue:'Di bawah lumut, kau menemukan tulisan: “Kami tidak menghancurkan kristal. Kami menyembunyikan jantungnya dari mahkota.” Sejarah yang diajarkan di desa menyimpan kebohongan.',reward:40},
  {name:'Persaudaraan Petualang',objective:'Bicara dengan Mira, wakil guild di desa.',dialogue:'Aku Mira. Perjalanan ini akan lebih ringan bersama sahabat. Undang pengembara dari panel Sosial, atau dirikan guild. Ruang bawah tanah dapat dimasuki sendiri atau bersama empat petualang.',reward:30},
  {name:'Rahasia Ruang Bawah Tanah',objective:'Kalahkan Penjaga Sumpah dan buka peti crypt.',dialogue:'Kristal terakhir berbisik: “Musuh itu bukan datang dari luar. Raja memecah tujuh cahaya untuk mengurung putrinya sendiri.” Sang Penjaga berlutut. Di utara, satu bintang padam. Bab I selesai — sumpah siapa yang akan kau percayai?',reward:100}
] as const;
export interface Appearance {hair:number;hairColor:string;skin:string;eyes:number;outfit:string}
export interface Plot {crop:CropId;plantedAt:number;watered:boolean}
export interface Furniture {id:string;kind:string;x:number;y:number}
export interface Character {id:string;userId:string;name:string;classId:ClassId;appearance:Appearance;level:number;xp:number;hp:number;gold:number;zone:Zone;x:number;y:number;inventory:Record<string,number>;equipment:Record<string,string>;quest:number;accepted:boolean;kills:number;clue:boolean;plots:Record<string,Plot>;furniture:Furniture[];houseOwned:boolean;farmLevel:number;guildId:string|null;completed:string[];cooldowns?:number[];lastGatherAt?:number}
export interface Avatar {id:string;name:string;classId:ClassId;appearance:Appearance;x:number;y:number;hp:number;maxHp:number;level:number;guild:string;emote:string;facing:number}
export interface Enemy {id:string;kind:string;name:string;x:number;y:number;hp:number;maxHp:number;damage:number;homeX:number;homeY:number;lastAttack:number;deadAt:number}
export interface Social {guild:{id:string;name:string;leader:string;members:{id:string;name:string}[]}|null;party:{id:string;leader:string;members:{id:string;name:string;hp:number;maxHp:number}[]}|null;invites:{kind:'guild'|'party';from:string;name:string;id:string}[]}
export interface Snapshot {me:Character;players:Avatar[];enemies:Enemy[];social:Social;instance:string;chest:boolean;time:number;online:number}
export const WORLD = {width:1600,height:1200,spawn:{x:800,y:690}};
export const NPCS = [{id:'elder',name:'Tetua Aruna',x:740,y:550,color:'#c8b0df'},{id:'merchant',name:'Banyu · Pedagang',x:470,y:750,color:'#e8b968'},{id:'guild',name:'Mira · Persaudaraan',x:1080,y:570,color:'#93c8c4'}];
export const PORTALS:Record<Zone,{to:Zone;x:number;y:number;label:string}[]> = {
 village:[{to:'forest',x:1460,y:650,label:'Whispering Forest →'},{to:'farm',x:250,y:1040,label:'↓ Kebun & Rumah'},{to:'crypt',x:1180,y:220,label:'Forgotten Crypt'}],
 forest:[{to:'village',x:100,y:650,label:'← Eldermere'}],farm:[{to:'village',x:800,y:1100,label:'↓ Eldermere'},{to:'house',x:800,y:285,label:'Rumah Pengembara'}],house:[{to:'farm',x:800,y:1000,label:'↓ Kebun'}],crypt:[{to:'village',x:160,y:1030,label:'← Eldermere'}]
};
export interface Rect {x:number;y:number;w:number;h:number}
export const OBSTACLES:Record<Zone,Rect[]> = {
 village:[{x:300,y:230,w:250,h:160},{x:920,y:300,w:240,h:130},{x:250,y:500,w:190,h:120},{x:1000,y:790,w:245,h:160},{x:640,y:800,w:130,h:95},{x:70,y:100,w:140,h:330}],
 forest:[{x:520,y:330,w:180,h:180},{x:850,y:680,w:180,h:180},{x:200,y:820,w:180,h:160}],
 farm:[{x:650,y:120,w:300,h:130}],house:[{x:150,y:130,w:1300,h:70},{x:150,y:200,w:60,h:850},{x:1390,y:200,w:60,h:850}],
 crypt:[{x:480,y:100,w:45,h:760},{x:1020,y:360,w:45,h:760},{x:525,y:540,w:300,h:45}]
};
export function blocked(zone:Zone,x:number,y:number){return x<55||y<70||x>1545||y>1130||OBSTACLES[zone].some(r=>x>r.x-12&&x<r.x+r.w+12&&y>r.y-10&&y<r.y+r.h+10);}
export const maxHp=(c:Pick<Character,'classId'|'level'>)=> (c.classId==='Knight'?140:100)+(c.level-1)*12;
export const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export const plotPosition=(i:number)=>({x:540+(i%4)*100,y:520+Math.floor(i/4)*100});
export const cropReady=(p:Plot,now=Date.now())=>p.watered&&now-p.plantedAt>=CROPS[p.crop].seconds*1000;

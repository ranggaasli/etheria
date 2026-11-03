import Phaser from 'phaser';
import { mapArt,avatarArt,enemyArt } from './art';
import { CROPS,NPCS,PORTALS,plotPosition,cropReady,distance,type Snapshot,type Zone,type Avatar,OBSTACLES } from '../shared/content';
export interface Bridge {snapshot:Snapshot|null;send:(type:string,payload:unknown)=>void;interact:(target?:string)=>void;panel:(id:string)=>void;muted:boolean;volume:number}
export function sound(bridge:Bridge,frequency=600){if(bridge.muted)return;try{const ctx=new AudioContext(),o=ctx.createOscillator(),gain=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.5,ctx.currentTime+.15);gain.gain.setValueAtTime(bridge.volume*.13,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);o.connect(gain);gain.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.2);o.onended=()=>void ctx.close();}catch{/* Audio may require a browser gesture. */}}
export class WorldScene extends Phaser.Scene {
  bridge:Bridge;
  zone:Zone='village';map!:Phaser.GameObjects.Image;keys!:Record<string,Phaser.Input.Keyboard.Key>;
  players=new Map<string,Phaser.GameObjects.Container>();enemies=new Map<string,Phaser.GameObjects.Container>();decor:Phaser.GameObjects.GameObject[]=[];
  plots:Phaser.GameObjects.GameObject[]=[];follow!:Phaser.GameObjects.Zone;lastInput=0;lastDecor=0;lastZone='';ambient!:Phaser.GameObjects.Graphics;
  constructor(bridge:Bridge){super('world');this.bridge=bridge;}
  create(){
    this.game.canvas.tabIndex=0;
    this.textures.addCanvas('map-village',mapArt('village'));
    for(const kind of ['slime','wisp','elite','boss'])this.textures.addCanvas(kind,enemyArt(kind));
    this.map=this.add.image(0,0,'map-village').setOrigin(0).setDepth(-20);
    this.follow=this.add.zone(800,650,1,1);this.cameras.main.setBounds(0,0,1600,1200);this.cameras.main.startFollow(this.follow,true,.075,.075);this.cameras.main.setZoom(1.08);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,I,J,ESC,ONE,TWO,THREE,SPACE,FOUR') as typeof this.keys;
    this.input.keyboard!.on('keydown',(e:KeyboardEvent)=>{
      if(this.typing())return;
      if(e.code==='KeyE')this.bridge.interact();
      if(e.code==='KeyI')this.bridge.panel('inventory');if(e.code==='KeyJ')this.bridge.panel('journal');if(e.code==='Escape')this.bridge.panel('settings');
      if(['Digit1','Digit2','Digit3','Space'].includes(e.code)){e.preventDefault();this.bridge.send('attack',e.code==='Digit2'?1:e.code==='Digit3'?2:0);sound(this.bridge,430);}
      if(e.code==='Digit4')this.bridge.send('action',{type:'potion'});
    });
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      this.game.canvas.focus({preventScroll:true});
      if(!this.bridge.snapshot)return;
      const point={x:p.worldX,y:p.worldY};const target=this.closest(point);
      if(target&&distance(point,target)<85)this.bridge.interact(target.id);
      else this.bridge.send('attack',0);
    });
    this.ambient=this.add.graphics().setDepth(9000).setScrollFactor(0);
    for(let i=0;i<26;i++){const p=this.add.circle(100+Math.random()*1400,100+Math.random()*1000,Math.random()*2+1,0xd8e5b0,.35).setDepth(7000);this.tweens.add({targets:p,y:p.y-65,alpha:.05,duration:2500+Math.random()*4000,yoyo:true,repeat:-1});}
    this.drawDecor();
  }
  typing(){const tag=document.activeElement?.tagName;return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||!!document.querySelector('[data-modal="true"]');}
  closest(point:{x:number;y:number}){
    const targets=this.zone==='village'?NPCS.map(n=>({...n})):[];
    const ports=PORTALS[this.zone].map(p=>({...p,id:'travel:'+p.to}));
    const plots=this.zone==='farm'?Array.from({length:8+(this.bridge.snapshot?.me.farmLevel||1)*4},(_,i)=>({...plotPosition(i),id:'plot:'+i})):[];
    const extra=this.zone==='forest'?[{id:'clue',x:1370,y:300},{id:'gather',x:350,y:720}]:this.zone==='crypt'&&this.bridge.snapshot?.chest?[{id:'chest',x:1380,y:180}]:[];
    return [...targets,...ports,...plots,...extra].sort((a,b)=>distance(point,a)-distance(point,b))[0];
  }
  label(x:number,y:number,text:string,color='#e8e3c8',size=12){return this.add.text(x,y,text,{fontFamily:'Georgia, serif',fontSize:size,color,backgroundColor:'#152b2bd9',padding:{x:8,y:4}}).setOrigin(.5).setDepth(y+100);}
  drawDecor(){
    this.decor.forEach(o=>o.destroy());this.decor=[];
    for(const p of PORTALS[this.zone])this.decor.push(this.label(p.x,p.y+35,p.label));
    if(this.zone==='village')for(const n of NPCS){const key='npc'+n.id;if(!this.textures.exists(key))this.textures.addCanvas(key,avatarArt({hair:1,hairColor:'#d5c8a4',skin:'#ddad87',eyes:0,outfit:n.color},n.id==='elder'?'Mage':'Ranger'));this.decor.push(this.add.image(n.x,n.y,key).setOrigin(.5,.87).setDepth(n.y),this.label(n.x,n.y-81,n.name,'#f1d79c',12));}
    if(this.zone==='forest'){this.decor.push(this.label(1370,330,'✧ Altar Kristal'),this.label(350,750,'❧ Daun Embun'));}
    if(this.zone==='crypt'&&this.bridge.snapshot?.chest){const g=this.add.graphics();g.fillStyle(0xdeb970);g.fillRoundedRect(1357,162,46,32,5);g.lineStyle(3,0x685334);g.strokeRoundedRect(1357,162,46,32,5);g.setDepth(180);this.decor.push(g,this.label(1380,220,'E · Buka peti'));}
  }
  avatar(a:Avatar){
    let container=this.players.get(a.id);const me=a.id===this.bridge.snapshot?.me.id;
    if(!container){
      container=this.add.container(a.x,a.y);const image=this.add.image(0,-28,'slime');const name=this.add.text(0,-83,a.name,{fontFamily:'Georgia',fontSize:12,color:me?'#fff1bb':'#e6f0e2',stroke:'#1a3034',strokeThickness:4}).setOrigin(.5);
      const guild=this.add.text(0,-99,a.guild?'< '+a.guild+' >':'',{fontFamily:'sans-serif',fontSize:10,color:'#9bd5c2',stroke:'#203332',strokeThickness:3}).setOrigin(.5);
      const bar=this.add.graphics();const emote=this.add.text(0,-119,'',{fontSize:24,color:'#fff0c3'}).setOrigin(.5);container.add([image,name,guild,bar,emote]);this.players.set(a.id,container);
    }
    const moving=Math.hypot(container.x-a.x,container.y-a.y)>2,frame=moving?Math.floor(this.time.now/110)%4:0;const dx=Math.cos(a.facing),dy=Math.sin(a.facing);const direction=Math.abs(dx)>Math.abs(dy)?dx>0?3:2:dy>0?1:0;
    const key=a.id+'-'+JSON.stringify(a.appearance)+'-'+frame+'-'+direction;
    if(!this.textures.exists(key))this.textures.addCanvas(key,avatarArt(a.appearance,a.classId,frame,direction));
    (container.list[0] as Phaser.GameObjects.Image).setTexture(key).setY(-28+(!moving?Math.sin(this.time.now/500)*.6:0));
    (container.list[2] as Phaser.GameObjects.Text).setText(a.guild?'< '+a.guild+' >':'');(container.list[4]as Phaser.GameObjects.Text).setText(a.emote);
    const bar=container.list[3]as Phaser.GameObjects.Graphics;bar.clear();if(a.hp<a.maxHp){bar.fillStyle(0x233a3a);bar.fillRect(-20,-70,40,4);bar.fillStyle(0x93b99a);bar.fillRect(-20,-70,40*a.hp/a.maxHp,4);}
    const factor=me?.5:.23;container.x=Phaser.Math.Linear(container.x,a.x,factor);container.y=Phaser.Math.Linear(container.y,a.y,factor);container.setDepth(container.y);
    return container;
  }
  update(time:number){
    const s=this.bridge.snapshot;if(!s){this.follow.x=800+Math.sin(time/12000)*160;this.follow.y=620;return;}
    if(s.me.zone!==this.zone){this.zone=s.me.zone;if(!this.textures.exists('map-'+this.zone))this.textures.addCanvas('map-'+this.zone,mapArt(this.zone));this.map.setTexture('map-'+this.zone);this.players.forEach(p=>p.destroy());this.players.clear();this.enemies.forEach(e=>e.destroy());this.enemies.clear();this.follow.setPosition(s.me.x,s.me.y);this.cameras.main.centerOn(s.me.x,s.me.y);this.drawDecor();this.lastDecor=0;}
    const present=new Set(s.players.map(p=>p.id));for(const [id,o]of this.players)if(!present.has(id)){o.destroy();this.players.delete(id);}
    for(const p of s.players){const o=this.avatar(p);if(p.id===s.me.id)this.follow.setPosition(o.x,o.y);}
    const enemyIds=new Set(s.enemies.filter(e=>e.hp>0).map(e=>e.id));for(const [id,o]of this.enemies)if(!enemyIds.has(id)){o.destroy();this.enemies.delete(id);}
    for(const e of s.enemies.filter(e=>e.hp>0)){
      let o=this.enemies.get(e.id);if(!o){o=this.add.container(e.x,e.y);o.add([this.add.image(0,-28,e.kind).setScale(e.kind==='boss'?1.4:.85),this.add.graphics(),this.add.text(0,-83,e.name,{fontSize:10,color:'#dfc4be',fontFamily:'sans-serif',stroke:'#1e303a',strokeThickness:4}).setOrigin(.5)]);this.enemies.set(e.id,o);}
      o.x=Phaser.Math.Linear(o.x,e.x,.2);o.y=Phaser.Math.Linear(o.y,e.y,.2);o.setDepth(o.y);(o.list[0]as Phaser.GameObjects.Image).setY(-28+Math.sin(time/300+e.x)*2);
      const bar=o.list[1]as Phaser.GameObjects.Graphics;bar.clear();bar.fillStyle(0x1d2d35);bar.fillRect(-25,-71,50,5);bar.fillStyle(0xc9988c);bar.fillRect(-25,-71,50*e.hp/e.maxHp,5);
    }
    if(time-this.lastInput>50){let x=0,y=0;if(!this.typing()){x=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);y=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);}this.bridge.send('input',{x,y});this.lastInput=time;}
    const decorKey=JSON.stringify([s.me.plots,s.me.furniture,s.me.farmLevel,s.chest]);
    if(decorKey!==this.lastZone||time-this.lastDecor>1000){this.drawObjects();if(s.chest!==this.lastZone.includes('true'))this.drawDecor();this.lastZone=decorKey;this.lastDecor=time;}
    const darkness=this.zone==='crypt'?.08:this.zone==='house'?0:(Math.sin(s.time/150000)+1)*.055;this.ambient.clear();this.ambient.fillStyle(0x132b46,darkness);this.ambient.fillRect(0,0,this.scale.width,this.scale.height);
  }
  drawObjects(){
    this.plots.forEach(p=>p.destroy());this.plots=[];const s=this.bridge.snapshot;if(!s)return;
    if(this.zone==='farm')for(let i=0;i<8+s.me.farmLevel*4;i++){
      const p=plotPosition(i),g=this.add.graphics().setDepth(1);g.fillStyle(0x403f2d);g.fillRoundedRect(p.x-42,p.y-34,84,68,6);g.fillStyle(0x79634a);g.fillRoundedRect(p.x-39,p.y-31,78,62,5);g.lineStyle(2,0x5c4e3b);for(let y=-20;y<30;y+=12){g.beginPath();g.moveTo(p.x-30,p.y+y);g.lineTo(p.x+30,p.y+y);g.strokePath();}
      const crop=s.me.plots[String(i)];if(crop){const progress=Math.min(1,(Date.now()-crop.plantedAt)/(CROPS[crop.crop].seconds*1000));for(let j=0;j<4;j++){const x=p.x-21+(j%2)*40,y=p.y-8+Math.floor(j/2)*25;g.lineStyle(3,cropReady(crop)?0xcbb875:0x8caf67);g.beginPath();g.moveTo(x,y+5);g.lineTo(x,y-5-progress*18);g.strokePath();g.fillStyle(crop.crop==='moonflower'?0xb9a0dc:crop.crop==='carrot'?0xd3a16b:0xa7bf72);g.fillEllipse(x-4,y-8-progress*14,10+progress*4,5);g.fillEllipse(x+4,y-14-progress*14,10+progress*4,5);}if(crop.watered){g.fillStyle(0x94b9bb);g.fillCircle(p.x+29,p.y+23,3);}}
      this.plots.push(g);
    }
    if(this.zone==='house')for(const f of s.me.furniture){const g=this.add.graphics().setDepth(f.y);g.fillStyle(0x332f2644);g.fillEllipse(f.x+7,f.y+20,95,35);g.fillStyle(0x6a4d37);if(f.kind==='bed'){g.fillRoundedRect(f.x-55,f.y-65,110,130,5);g.fillStyle(0xb1c2af);g.fillRect(f.x-48,f.y-40,96,100);g.fillStyle(0xe1d9ba);g.fillRoundedRect(f.x-40,f.y-55,80,27,5);g.fillStyle(0x698c88);g.fillRect(f.x-48,f.y+5,96,55);}
      else if(f.kind==='table'){g.fillRect(f.x-55,f.y-25,12,60);g.fillRect(f.x+45,f.y-25,12,60);g.fillStyle(0xb18c5d);g.fillRoundedRect(f.x-70,f.y-47,140,72,6);g.lineStyle(2,0x8c6b48);g.strokeRoundedRect(f.x-70,f.y-47,140,72,6);}
      else if(f.kind==='plant'){g.fillStyle(0xa37a57);g.fillRect(f.x-20,f.y-6,40,32);g.fillStyle(0x78966c);for(let j=0;j<6;j++)g.fillEllipse(f.x+Math.sin(j)*19,f.y-20-Math.cos(j)*14,28,13);}
      else{g.fillStyle(f.kind==='chest'?0x9b8052:0x957850);g.fillRoundedRect(f.x-30,f.y-25,60,45,4);g.fillStyle(0xdbc184);g.fillRect(f.x-2,f.y-20,5,30);}this.plots.push(g);}
  }
  effect(data:{x:number;y:number;damage:number;skill?:number;classId?:string;hurt?:boolean}){
    const color=data.hurt?0xd28c82:data.classId==='Mage'?0xbba4ff:0xc6deab;const ring=this.add.circle(data.x,data.y-15,20,color,.28).setStrokeStyle(2,color,.7).setDepth(5000);this.tweens.add({targets:ring,scale:3,alpha:0,duration:420,onComplete:()=>ring.destroy()});
    const text=this.add.text(data.x,data.y-65,data.damage?String(data.damage):'+45',{fontFamily:'Georgia',fontSize:22,color:data.hurt?'#f1baaa':'#f8e4ac',stroke:'#263c3c',strokeThickness:3}).setOrigin(.5).setDepth(5001);this.tweens.add({targets:text,y:text.y-45,alpha:0,duration:850,onComplete:()=>text.destroy()});if(data.hurt)this.cameras.main.shake(70,.001);sound(this.bridge,data.hurt?180:760);
  }
}
export function createGame(parent:HTMLElement,bridge:Bridge){const scene=new WorldScene(bridge);const game=new Phaser.Game({type:Phaser.CANVAS,parent,backgroundColor:'#243f3a',fps:{target:60,limit:60},scale:{mode:Phaser.Scale.RESIZE,width:parent.clientWidth,height:parent.clientHeight},render:{pixelArt:true,antialias:false},scene:[scene],audio:{noAudio:true}});return {game,scene};}
export function miniMap(canvas:HTMLCanvasElement,s:Snapshot){const g=canvas.getContext('2d')!;g.clearRect(0,0,160,120);g.fillStyle=s.me.zone==='crypt'?'#283442':'#435f4d';g.fillRect(0,0,160,120);for(const o of OBSTACLES[s.me.zone]){g.fillStyle='#a3a189';g.fillRect(o.x/10,o.y/10,o.w/10,o.h/10);}for(const p of PORTALS[s.me.zone]){g.fillStyle='#b8dcd3';g.fillRect(p.x/10-2,p.y/10-2,4,4);}for(const e of s.enemies.filter(e=>e.hp>0)){g.fillStyle='#d3a095';g.fillRect(e.x/10-1,e.y/10-1,3,3);}for(const p of s.players){g.fillStyle=p.id===s.me.id?'#fae5ab':'#94ccdc';g.beginPath();g.arc(p.x/10,p.y/10,2.5,0,Math.PI*2);g.fill();}}

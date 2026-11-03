import type { Appearance,ClassId,Zone } from '../shared/content';
import { OBSTACLES,PORTALS } from '../shared/content';
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const rng=(seed:number)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
export function mapArt(zone:Zone){
  const c=canvas(1600,1200),g=c.getContext('2d')!,r=rng(130+zone.length);g.imageSmoothingEnabled=false;
  const floor=zone==='crypt'?'#2d3545':zone==='house'?'#795743':zone==='forest'?'#2d5645':'#527052';g.fillStyle=floor;g.fillRect(0,0,1600,1200);
  for(let i=0;i<14000;i++){const x=r()*1600,y=r()*1200;g.fillStyle=i%3?'#ffffff08':'#0c231822';g.fillRect(x,y,2+r()*5,2);}
  const shadow=(x:number,y:number,w:number,h:number)=>{g.fillStyle='#142c2b44';g.beginPath();g.ellipse(x,y,w,h,0,0,Math.PI*2);g.fill();};
  const path=(points:number[][],width:number)=>{g.lineJoin='round';g.lineCap='round';g.strokeStyle='#7d8066';g.lineWidth=width+13;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.strokeStyle='#ada88a';g.lineWidth=width;g.stroke();
    for(let i=0;i<points.length-1;i++){const [x,y]=points[i],[xx,yy]=points[i+1],d=Math.hypot(x-xx,y-yy);for(let j=0;j<d;j+=18){const t=j/d;g.fillStyle='#d4cbb02a';g.fillRect(x+(xx-x)*t-width/3+r()*width*.66,y+(yy-y)*t-5,8+r()*8,2);}}};
  function tree(x:number,y:number,s=1,pine=false){
    shadow(x+15*s,y+8*s,43*s,13*s);g.fillStyle='#4b4030';g.fillRect(x-6*s,y-40*s,12*s,42*s);g.fillStyle='#736046';g.fillRect(x-3*s,y-40*s,4*s,40*s);
    const colors=zone==='forest'?['#183d38','#1e4b3d','#2a5a42','#3b6a4b','#527c55']:['#274e3d','#356040','#426d46','#5b8152','#7c985e'];
    if(pine){for(let i=0;i<4;i++){g.fillStyle=colors[i];g.beginPath();g.moveTo(x,y-142*s+i*27*s);g.lineTo(x+(54-i*8)*s,y-30*s-i*10*s);g.lineTo(x-(54-i*8)*s,y-30*s-i*10*s);g.fill();}}
    else for(let i=0;i<5;i++){g.fillStyle=colors[i];g.beginPath();g.ellipse(x+(i%2?12:-8)*s,y-(57+i*11)*s,(50-i*5)*s,(38-i*4)*s,0,0,Math.PI*2);g.fill();}
    for(let i=0;i<9;i++){g.fillStyle='#b2bf7820';g.fillRect(x+(r()-.5)*70*s,y-50*s-r()*50*s,7*s,3*s);}
  }
  function building(x:number,y:number,w:number,h:number,roof='#7c6460'){
    shadow(x+w/2+20,y+h+13,w*.62,30);g.fillStyle='#73644f';g.fillRect(x-5,y,w+10,h+5);g.fillStyle='#c7b58d';g.fillRect(x,y,w,h);
    g.fillStyle='#a39371';g.fillRect(x+w*.73,y,w*.27,h);g.fillStyle='#514d3d';for(const xx of [x+8,x+w*.5,x+w-12])g.fillRect(xx,y,7,h);
    g.fillStyle='#6f6450';for(let j=y+14;j<y+h;j+=17){g.fillRect(x,j,w,2);}
    g.fillStyle='#323d3d';g.fillRect(x+w*.43,y+h-65,w*.2,65);g.fillStyle='#6f5b3d';g.fillRect(x+w*.43+5,y+h-62,w*.2-10,62);g.fillStyle='#dac07d';g.fillRect(x+w*.58,y+h-32,3,3);
    for(const xx of [x+w*.16,x+w*.76]){g.fillStyle='#615642';g.fillRect(xx-5,y+h*.35-6,40,40);g.fillStyle='#f4cf82';g.fillRect(xx,y+h*.35,30,28);g.fillStyle='#8e7852';g.fillRect(xx+13,y+h*.35,3,28);g.fillRect(xx,y+h*.35+13,30,3);}
    g.fillStyle='#383d37';g.beginPath();g.moveTo(x-22,y+15);g.lineTo(x+w/2,y-86);g.lineTo(x+w+22,y+15);g.closePath();g.fill();
    g.fillStyle=roof;g.beginPath();g.moveTo(x-19,y+7);g.lineTo(x+w/2,y-88);g.lineTo(x+w+18,y+7);g.closePath();g.fill();
    g.save();g.beginPath();g.moveTo(x-19,y+7);g.lineTo(x+w/2,y-88);g.lineTo(x+w+18,y+7);g.closePath();g.clip();
    for(let yy=y-87;yy<y+7;yy+=10){g.fillStyle='#ffffff10';g.fillRect(x-20,yy,w+40,3);g.fillStyle='#172c312c';g.fillRect(x-20,yy+8,w+40,2);for(let xx=x-20+(yy%20);xx<x+w+20;xx+=25){g.fillRect(xx,yy,2,10);}}
    g.restore();g.fillStyle='#b5a98c';g.fillRect(x+w*.72,y-78,25,50);g.fillStyle='#615d54';g.fillRect(x+w*.72-3,y-82,31,8);
    g.fillStyle='#e1c590';g.fillRect(x-20,y+5,w+40,5);g.fillStyle='#b6ab8e';g.fillRect(x+w*.4,y+h,w*.28,8);
  }
  function crystal(x:number,y:number,scale=1){
    shadow(x,y+15,42*scale,12*scale);g.fillStyle='#7d8984';g.fillRect(x-37*scale,y+1,74*scale,17*scale);g.fillStyle='#aab7a6';g.fillRect(x-27*scale,y-5,54*scale,12*scale);
    const glow=g.createRadialGradient(x,y-40*scale,0,x,y-40*scale,90*scale);glow.addColorStop(0,'#92ffe441');glow.addColorStop(1,'#5dbdff00');g.fillStyle=glow;g.fillRect(x-100*scale,y-130*scale,200*scale,200*scale);
    g.fillStyle='#9ae7de';g.beginPath();g.moveTo(x,y-88*scale);g.lineTo(x+22*scale,y-45*scale);g.lineTo(x,y+2*scale);g.lineTo(x-22*scale,y-45*scale);g.closePath();g.fill();g.fillStyle='#ceeef1';g.beginPath();g.moveTo(x,y-88*scale);g.lineTo(x,y+2*scale);g.lineTo(x-22*scale,y-45*scale);g.fill();
  }
  function fence(x:number,y:number,w:number){g.fillStyle='#766c4c';g.fillRect(x,y-22,w,5);g.fillRect(x,y-10,w,4);for(let xx=x;xx<=x+w;xx+=24){g.fillStyle='#a09a6c';g.fillRect(xx,y-31,5,35);g.fillStyle='#c1b788';g.fillRect(xx,y-32,5,3);}}
  if(zone==='village'){
    // Water and stone embankment on the western edge.
    g.fillStyle='#3a666d';g.fillRect(0,0,130,1200);g.fillStyle='#6d8173';g.fillRect(128,0,17,1200);for(let i=0;i<120;i++){g.fillStyle='#a6d5bc25';g.fillRect(r()*120,r()*1200,15+r()*20,2);}
    path([[190,1040],[340,920],[580,720],[800,650],[1460,650]],93);path([[800,650],[800,450],[1180,220]],70);path([[800,650],[800,1090]],70);
    // Village square with individual paving stones.
    g.fillStyle='#b0ad91';g.beginPath();g.ellipse(805,650,205,165,0,0,Math.PI*2);g.fill();
    for(let yy=510;yy<805;yy+=20)for(let xx=620;xx<1000;xx+=30)if(((xx-800)/180)**2+((yy-650)/145)**2<1){g.fillStyle=(xx+yy)%3?'#c7c2a1':'#bcb99b';g.fillRect(xx+(yy%40?10:0),yy,27,17);}
    building(300,230,250,160,'#6f7f79');building(920,300,240,130,'#776b85');building(250,500,190,120,'#ac7660');building(1000,790,245,160,'#677f7d');building(640,800,130,95,'#917a60');
    // Fountain sanctuary sits north of the spawn and remains walkable around it.
    g.fillStyle='#556e67';g.beginPath();g.ellipse(820,570,62,26,0,0,Math.PI*2);g.fill();g.fillStyle='#b8bca5';g.beginPath();g.ellipse(820,562,54,23,0,0,Math.PI*2);g.fill();g.fillStyle='#539894';g.beginPath();g.ellipse(820,560,44,17,0,0,Math.PI*2);g.fill();crystal(820,548,.48);
    // Merchant's striped awning.
    g.fillStyle='#6b553c';g.fillRect(423,771,94,13);g.fillRect(430,748,5,40);g.fillRect(505,748,5,40);for(let i=0;i<6;i++){g.fillStyle=i%2?'#d9bf85':'#a56550';g.fillRect(420+i*17,721,17,30);}g.fillStyle='#d4b16e';g.fillRect(435,758,20,9);g.fillStyle='#92a76c';g.fillRect(465,759,20,8);
    crystal(1180,225,.85);fence(210,1000,190);fence(490,1040,180);
    for(const [x,y]of [[190,350],[210,820],[575,470],[600,330],[1270,420],[1340,870],[940,1050],[390,1120]])tree(x,y,1+r()*.25);
    for(let i=0;i<65;i++){const x=160+r()*1400,y=80+r()*1040;if(y<160||y>1100)tree(x,y,.75+r()*.4,i%3===0);}
  }else if(zone==='forest'){
    path([[100,650],[400,650],[780,560],[1110,350],[1370,300]],58);path([[770,560],[1180,930]],40);
    for(let i=0;i<80;i++){const x=80+r()*1440,y=130+r()*1000;if(Math.abs(y-650)>120&&Math.hypot(x-1370,y-300)>140&&Math.hypot(x-740,y-260)>100)tree(x,y,.65+r()*.75,i%4===0);}
    for(const o of OBSTACLES.forest){g.fillStyle='#4e6659';g.fillRect(o.x,o.y,o.w,o.h);g.fillStyle='#789080';g.fillRect(o.x,o.y,o.w,13);for(let i=0;i<9;i++)tree(o.x+r()*o.w,o.y+r()*o.h,.8);}
    crystal(1370,300,1.1);g.fillStyle='#96cda0';for(let i=0;i<12;i++)g.fillRect(320+r()*60,690+r()*30,4,10);
  }else if(zone==='farm'){
    path([[800,1100],[800,350]],65);building(650,120,300,130,'#6b8581');fence(390,420,800);fence(390,970,800);
    for(const [x,y]of [[250,350],[1280,350],[220,900],[1350,950]])tree(x,y,1.5);
    g.fillStyle='#8e7851';g.fillRect(1110,670,65,40);g.fillStyle='#7aa5ac';g.beginPath();g.ellipse(1142,670,31,14,0,0,Math.PI*2);g.fill();
  }else if(zone==='house'){
    g.fillStyle='#1a272a';g.fillRect(0,0,1600,1200);g.fillStyle='#957557';g.fillRect(210,200,1180,850);
    for(let y=200;y<1050;y+=35){g.fillStyle=y%70?'#a17e59':'#927351';g.fillRect(210,y,1180,33);for(let x=210+(y%70?0:120);x<1390;x+=240){g.fillStyle='#5b4c3955';g.fillRect(x,y,2,33);}}
    for(const o of OBSTACLES.house){g.fillStyle='#b6a17b';g.fillRect(o.x,o.y,o.w,o.h);g.fillStyle='#cbb88e';g.fillRect(o.x,o.y,o.w,15);}
    g.fillStyle='#9c6265';g.fillRect(570,470,450,300);g.strokeStyle='#d5b87b';g.lineWidth=5;g.strokeRect(580,480,430,280);g.fillStyle='#6b5946';g.fillRect(710,160,180,100);g.fillStyle='#c4b693';g.fillRect(720,170,160,85);g.fillStyle='#304a54';g.fillRect(740,190,120,60);g.fillStyle='#b1ab8a';g.fillRect(798,190,4,60);
  }else{
    g.fillStyle='#30394b';g.fillRect(70,70,1470,1060);for(let y=80;y<1130;y+=45)for(let x=80+(y%90?20:0);x<1530;x+=70){g.fillStyle=r()>.4?'#394456':'#354051';g.fillRect(x,y,66,41);g.fillStyle='#6b778015';g.fillRect(x,y,66,2);}
    for(const o of OBSTACLES.crypt){g.fillStyle='#121f30';g.fillRect(o.x+10,o.y+16,o.w,o.h);g.fillStyle='#596074';g.fillRect(o.x,o.y,o.w,o.h);g.fillStyle='#78808e';g.fillRect(o.x,o.y,o.w,9);for(let y=o.y;y<o.y+o.h;y+=26){g.fillStyle='#273444';g.fillRect(o.x,y,o.w,2);}}
    for(const [x,y]of [[230,300],[430,520],[710,140],[960,730],[1150,170],[1440,690]]){g.fillStyle='#697182';g.fillRect(x-18,y-55,36,58);g.fillStyle='#9ca2ad';g.fillRect(x-23,y-60,46,10);crystal(x,y-50,.27);}
    crystal(1360,140,.7);
  }
  // Boundary shade and wildflowers unify all outdoor maps.
  if(zone!=='crypt'&&zone!=='house')for(let i=0;i<330;i++){const x=r()*1500+70,y=r()*1100+50;if(OBSTACLES[zone].some(o=>x>o.x-20&&x<o.x+o.w+20&&y>o.y-80&&y<o.y+o.h))continue;g.fillStyle=['#c6c28b','#a1b4c2','#d3ae9d'][i%3];g.fillRect(x,y,3,3);g.fillStyle='#94a36b';g.fillRect(x+1,y+3,1,4);}
  const vignette=g.createRadialGradient(800,600,400,800,600,1000);vignette.addColorStop(0,'#06171b00');vignette.addColorStop(1,'#06171b77');g.fillStyle=vignette;g.fillRect(0,0,1600,1200);
  // Portal marks are readable without relying on UI panels.
  for(const p of PORTALS[zone]){g.strokeStyle=p.to==='crypt'?'#9bc9d4':'#c6c09a';g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y+5,35,13,0,0,Math.PI*2);g.stroke();}
  return c;
}
export function avatarArt(a:Appearance,cls:ClassId,frame=0,facing=1){
  const c=canvas(64,80),g=c.getContext('2d')!;g.imageSmoothingEnabled=false;
  const bob=frame%2?1:0,step=frame===1?-3:frame===3?3:0;
  g.fillStyle='#102d3559';g.beginPath();g.ellipse(32,70,17,6,0,0,Math.PI*2);g.fill();
  g.fillStyle='#252f3f';g.fillRect(22,51+bob,8,16+step);g.fillRect(35,51+bob,8,16-step);g.fillStyle='#504635';g.fillRect(20,64+step,12,6);g.fillRect(34,64-step,12,6);
  g.fillStyle=cls==='Mage'?'#555073':a.outfit;g.beginPath();g.moveTo(23,31+bob);g.lineTo(41,31+bob);g.lineTo(49,57+bob);g.lineTo(17,57+bob);g.fill();
  g.fillStyle='#ffffff28';g.fillRect(24,33+bob,5,22);g.fillStyle='#182a3c55';g.fillRect(37,35+bob,5,22);
  g.fillStyle=a.skin;g.fillRect(15,37+bob,7,14);g.fillRect(43,37+bob,7,14);g.fillRect(29,27+bob,7,9);g.fillRect(22,12+bob,22,20);g.fillRect(25,9+bob,16,26);
  g.fillStyle=a.hairColor;g.fillRect(21,9+bob,23,9);g.fillRect(18,14+bob,7,a.hair===2?21:12);g.fillRect(41,15+bob,6,a.hair===1?27:10);if(a.hair===3)g.fillRect(30,4+bob,7,9);
  if(facing!==0){g.fillStyle='#243a41';if(facing!==3)g.fillRect(facing===2?24:27,23+bob,a.eyes===1?4:2,a.eyes===2?2:3);if(facing!==2)g.fillRect(facing===3?40:37,23+bob,2,a.eyes===2?2:3);g.fillStyle='#e5bd9e';g.fillRect(facing===2?24:facing===3?40:32,29+bob,a.eyes===2?5:3,2);}
  else{g.fillStyle=a.hairColor;g.fillRect(23,16+bob,20,16);}
  g.fillStyle='#e4c585';g.fillRect(21,47+bob,24,4);g.fillStyle='#665b44';g.fillRect(30,47+bob,6,5);
  if(cls==='Knight'){g.fillStyle='#b8ccca';g.fillRect(48,29+bob,4,29);g.fillStyle='#ebd28f';g.fillRect(43,48+bob,14,4);g.fillStyle='#587c80';g.fillRect(9,37+bob,12,21);g.fillStyle='#abc4b1';g.fillRect(13,40+bob,4,15);}
  if(cls==='Mage'){g.fillStyle='#80684b';g.fillRect(49,20+bob,4,43);g.fillStyle='#badce9';g.fillRect(46,15+bob,10,10);g.fillStyle='#ddd5f0';g.fillRect(27,35+bob,10,4);}
  if(cls==='Ranger'){g.strokeStyle='#d9bd7c';g.lineWidth=3;g.beginPath();g.arc(45,43+bob,15,-1.2,1.2);g.stroke();g.strokeStyle='#e0d8b5';g.lineWidth=1;g.beginPath();g.moveTo(50,29+bob);g.lineTo(50,57+bob);g.stroke();}
  return c;
}
export function enemyArt(kind:string){
  const c=canvas(90,90),g=c.getContext('2d')!;g.fillStyle='#102b3566';g.beginPath();g.ellipse(45,76,27,8,0,0,Math.PI*2);g.fill();
  if(kind==='slime'){g.fillStyle='#6db69a';g.beginPath();g.ellipse(45,57,25,22,0,Math.PI,Math.PI*2);g.lineTo(70,73);g.quadraticCurveTo(45,82,20,73);g.fill();g.fillStyle='#a0d4b0';g.fillRect(30,44,9,5);g.fillStyle='#274c50';g.fillRect(35,59,4,6);g.fillRect(53,59,4,6);}
  else if(kind==='wisp'){const glow=g.createRadialGradient(45,45,0,45,45,40);glow.addColorStop(0,'#c8d5ffcc');glow.addColorStop(1,'#9acdea00');g.fillStyle=glow;g.fillRect(0,0,90,90);g.fillStyle='#acbde7';g.beginPath();g.moveTo(45,20);g.quadraticCurveTo(78,50,55,74);g.lineTo(47,67);g.lineTo(34,78);g.quadraticCurveTo(15,48,45,20);g.fill();g.fillStyle='#384659';g.fillRect(34,47,5,5);g.fillRect(50,47,5,5);}
  else{const boss=kind==='boss';g.fillStyle=boss?'#777a9d':'#8276a0';g.fillRect(28,32,36,32);g.fillRect(22,42,12,28);g.fillRect(60,42,12,28);g.fillStyle='#435366';g.fillRect(29,64,12,15);g.fillRect(52,64,12,15);g.fillStyle='#b4c6cc';g.fillRect(31,18,29,24);g.fillStyle='#6c75a4';g.fillRect(35,26,21,7);g.fillStyle='#edbb8e';g.fillRect(37,28,5,3);g.fillRect(49,28,5,3);g.fillStyle='#beac83';g.fillRect(40,44,9,14);g.strokeStyle='#d6c6aa';g.lineWidth=4;g.beginPath();g.moveTo(33,20);g.lineTo(23,7);g.lineTo(16,14);g.moveTo(57,20);g.lineTo(67,7);g.lineTo(74,14);g.stroke();}
  return c;
}

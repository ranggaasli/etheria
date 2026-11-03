import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { maxHp, type Character, type Appearance } from '../shared/content.js';

export const appearanceSchema=z.object({hair:z.number().int().min(0).max(3),hairColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),skin:z.string().regex(/^#[0-9a-fA-F]{6}$/),eyes:z.number().int().min(0).max(2),outfit:z.string().regex(/^#[0-9a-fA-F]{6}$/)});
export const characterSchema=z.object({name:z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{2,17}$/,'Nama harus 3–18 huruf/angka, diawali huruf.'),classId:z.enum(['Knight','Mage','Ranger']),appearance:appearanceSchema});
export type Row=Record<string,any>;
export interface Query { (sql:string,args?:unknown[]):Promise<Row[]> }

// This typed repository is the only SQL boundary. Both adapters run the same
// transaction and constraints; SQLite is a durable local development adapter.
export class Store {
  sqlite?:DatabaseSync;
  pool?:pg.Pool;
  private tail:Promise<unknown>=Promise.resolve();
  constructor(path=process.env.SQLITE_PATH||'data/etheria.sqlite',url=process.env.DATABASE_URL){
    if(url){this.pool=new pg.Pool({connectionString:url,ssl:{rejectUnauthorized:true,...(process.env.PG_CA_FILE?{ca:readFileSync(process.env.PG_CA_FILE,'utf8')}:{})},max:5});}
    else{mkdirSync(dirname(path),{recursive:true});this.sqlite=new DatabaseSync(path);this.sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');}
  }
  query:Query=async(sql,args=[])=>{
    let n=0;
    if(this.pool) return (await this.pool.query(sql.replace(/\?/g,()=>'$'+(++n)),args)).rows;
    return this.sqlite!.prepare(sql).all(...args as any[]) as Row[];
  };
  async init(){
    const text=readFileSync('migrations/001_initial.sql','utf8');
    if(this.sqlite) this.sqlite.exec(text);else await this.pool!.query(text);
  }
  async transaction<T>(fn:(q:Query)=>Promise<T>):Promise<T>{
    const run=async()=>{
      const client=this.pool?await this.pool.connect():null;
      const q:Query=async(sql,args=[])=>{
        if(client){let n=0;return (await client.query(sql.replace(/\?/g,()=>'$'+(++n)),args)).rows;}
        return this.sqlite!.prepare(sql).all(...args as any[]) as Row[];
      };
      try {await q('BEGIN');const result=await fn(q);await q('COMMIT');return result;}
      catch(e){await q('ROLLBACK');throw e;}finally{client?.release();}
    };
    const next=this.tail.then(run,run);this.tail=next.catch(()=>{});return next;
  }
  async character(userId:string){return this.transaction(async q=>this.load((await q('SELECT * FROM characters WHERE user_id=?',[userId]))[0],q));}
  async byId(id:string){return this.transaction(async q=>this.load((await q('SELECT * FROM characters WHERE id=?',[id]))[0],q));}
  private async load(row:Row|undefined,q:Query):Promise<Character|null>{
    if(!row)return null;
    const c=JSON.parse(row.data) as Character;
    const [inv,plots,furniture,member]=await Promise.all([
      q('SELECT item_id,quantity FROM inventory WHERE character_id=?',[c.id]),q('SELECT plot_id,data FROM farming_plots WHERE character_id=?',[c.id]),
      q('SELECT data FROM furniture_placements WHERE character_id=?',[c.id]),q('SELECT guild_id FROM guild_members WHERE character_id=?',[c.id])]);
    c.inventory=Object.fromEntries(inv.map(r=>[r.item_id,Number(r.quantity)]));c.plots=Object.fromEntries(plots.map(r=>[r.plot_id,JSON.parse(r.data)]));c.furniture=furniture.map(r=>JSON.parse(r.data));c.guildId=member[0]?.guild_id||null;return c;
  }
  async create(userId:string,input:unknown){
    const v=characterSchema.parse(input);
    const c:Character={id:randomUUID(),userId,name:v.name,classId:v.classId,appearance:v.appearance as Appearance,level:1,xp:0,hp:100,gold:40,zone:'village',x:800,y:690,inventory:{wheat_seed:4,carrot_seed:2,potion:3,tunic:1},equipment:{},quest:0,accepted:false,kills:0,clue:false,plots:{},furniture:[{id:'bed',kind:'bed',x:340,y:350},{id:'table',kind:'table',x:800,y:500},{id:'chair',kind:'chair',x:800,y:650},{id:'chest',kind:'chest',x:1100,y:350},{id:'plant',kind:'plant',x:1200,y:750}],houseOwned:true,farmLevel:1,guildId:null,completed:[]};
    c.hp=maxHp(c);
    await this.transaction(async q=>{await q('INSERT INTO characters(id,user_id,name,data) VALUES(?,?,?,?)',[c.id,userId,c.name,JSON.stringify(c)]);await this.saveIn(q,c);});return c;
  }
  async saveIn(q:Query,c:Character){
    const {inventory,plots,furniture,...core}=c;
    await q('UPDATE characters SET data=? WHERE id=?',[JSON.stringify(core),c.id]);
    for(const table of ['inventory','farming_plots','furniture_placements'])await q(`DELETE FROM ${table} WHERE character_id=?`,[c.id]);
    for(const [id,quantity]of Object.entries(inventory))if(quantity>0)await q('INSERT INTO inventory(character_id,item_id,quantity) VALUES(?,?,?)',[c.id,id,quantity]);
    for(const [id,p]of Object.entries(plots))await q('INSERT INTO farming_plots(character_id,plot_id,data) VALUES(?,?,?)',[c.id,id,JSON.stringify(p)]);
    for(const f of furniture)await q('INSERT INTO furniture_placements(character_id,id,data) VALUES(?,?,?)',[c.id,f.id,JSON.stringify(f)]);
    await q('INSERT INTO quest_progress(character_id,chapter,accepted,kills,clue) VALUES(?,?,?,?,?) ON CONFLICT(character_id) DO UPDATE SET chapter=excluded.chapter,accepted=excluded.accepted,kills=excluded.kills,clue=excluded.clue',[c.id,c.quest,c.accepted?1:0,c.kills,c.clue?1:0]);
  }
  async save(c:Character){await this.transaction(q=>this.saveIn(q,c));}
  async guild(c:Character){
    const rows=await this.query('SELECT g.id,g.name,g.leader FROM guilds g JOIN guild_members m ON m.guild_id=g.id WHERE m.character_id=?',[c.id]);
    if(!rows[0])return null;
    const g=rows[0];const members=await this.query('SELECT c.id,c.name FROM characters c JOIN guild_members m ON m.character_id=c.id WHERE m.guild_id=?',[g.id]);
    return {id:g.id as string,name:g.name as string,leader:g.leader as string,members:members.map(r=>({id:r.id as string,name:r.name as string}))};
  }
  async createGuild(c:Character,name:string){
    if(!/^[\p{L}\p{N} _-]{3,24}$/u.test(name))throw Error('Nama guild harus 3–24 karakter.');
    return this.transaction(async q=>{
      if((await q('SELECT * FROM guild_members WHERE character_id=?',[c.id])).length)throw Error('Kamu sudah bergabung dengan guild.');
      const id=randomUUID();await q('INSERT INTO guilds(id,name,leader) VALUES(?,?,?)',[id,name,c.id]);await q('INSERT INTO guild_members(character_id,guild_id) VALUES(?,?)',[c.id,id]);return id;
    });
  }
  async joinGuild(c:Character,id:string,leader:string){await this.transaction(async q=>{
    if(!(await q('SELECT id FROM guilds WHERE id=? AND leader=?',[id,leader])).length)throw Error('Undangan tidak berlaku.');
    await q('INSERT INTO guild_members(character_id,guild_id) VALUES(?,?)',[c.id,id]);
  });}
  async leaveGuild(c:Character){await this.transaction(async q=>{
    const g=(await q('SELECT g.id,g.leader FROM guilds g JOIN guild_members m ON m.guild_id=g.id WHERE m.character_id=?',[c.id]))[0];if(!g)return;
    await q('DELETE FROM guild_members WHERE character_id=?',[c.id]);
    if(g.leader===c.id){const next=(await q('SELECT character_id FROM guild_members WHERE guild_id=? ORDER BY character_id LIMIT 1',[g.id]))[0];if(next)await q('UPDATE guilds SET leader=? WHERE id=?',[next.character_id,g.id]);else await q('DELETE FROM guilds WHERE id=?',[g.id]);}
  });}
  async close(){await this.tail;this.sqlite?.close();await this.pool?.end();}
}

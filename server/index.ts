import 'dotenv/config';
import { defineServer,defineRoom,matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { Auth,digest } from './auth.js';
import { Realm,tickets,realm } from './realm.js';

const production=process.env.NODE_ENV==='production';
const store=new Store();await store.init();Realm.store=store;const auth=new Auth(store);
auth.onLogout=async userId=>{if(realm)for(const a of realm.actors.values())if(a.c.userId===userId){await a.client.leave(4000);}};
const server=defineServer({
  auth:false,
  greet:false,transport:new WebSocketTransport({maxPayload:16384,pingInterval:10000,pingMaxRetries:3}),
  rooms:{realm:defineRoom(Realm)},
  express:async app=>{
    app.set('trust proxy',1);
    app.use(helmet({contentSecurityPolicy:production?{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],workerSrc:["'self'",'blob:'],fontSrc:["'self'"],objectSrc:["'none'"]}}:false}));
    app.use(express.json({limit:'16kb'}),cookieParser());
    app.use('/api',(req,res,next)=>{if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==new URL(process.env.PUBLIC_URL||'http://localhost:3000').origin)return res.status(403).json({error:'Origin tidak diizinkan.'});next();});
    app.use('/api',rateLimit({windowMs:60000,limit:160,standardHeaders:'draft-8',legacyHeaders:false}));
    app.get('/health',(_req,res)=>res.json({ok:true,auth:auth.mode,storage:store.pool?'postgres':'sqlite'}));
    auth.mount(app);
    app.post('/api/character',async(req,res,next)=>{try{const id=await auth.user(req.cookies.etheria_session);if(!id)return res.status(401).json({error:'Silakan masuk.'});const c=await store.create(id,req.body);res.json(c);}catch(e){next(e);}});
    app.post('/api/ticket',async(req,res,next)=>{try{const id=await auth.user(req.cookies.etheria_session);if(!id)return res.status(401).json({error:'Silakan masuk.'});if(!await store.character(id))return res.status(409).json({error:'Buat karakter terlebih dahulu.'});const token=randomBytes(32).toString('hex');tickets.set(token,{userId:id,sessionHash:digest(req.cookies.etheria_session),expires:Date.now()+20000});res.json({ticket:token});}catch(e){next(e);}});
    if(production||process.env.SERVE_BUILD==='1'){
      app.use(express.static(resolve('dist/client'),{index:false,maxAge:'1h'}));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/client/index.html')));
    }else{
      const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
      app.use(vite.middlewares);
    }
    app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const conflict=/unique|constraint/i.test(err.message);res.status(conflict?409:400).json({error:conflict?'Nama atau email sudah digunakan.':err.message.slice(0,250)});});
  }
});
const port=Number(process.env.PORT||3000);await server.listen(port,'0.0.0.0');
// One single shared room for the MVP. No accidental overflow shards.
await matchMaker.createRoom('realm',{});
console.log(`ETHERIA ready: http://localhost:${port} (${auth.mode} authentication)`);
const shutdown=async()=>{await realm?.onDispose();await server.gracefullyShutdown(false);await store.close();process.exit(0);};
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
process.on('message',message=>{if(message==='shutdown')void shutdown();});

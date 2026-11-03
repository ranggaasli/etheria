import { randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Application,Request,Response,NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Store } from './store.js';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const creds=z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(8).max(128)});
export const passwordHash=(password:string)=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');};
export const checkPassword=(password:string,hash:string)=>{const [salt,key]=hash.split(':');return !!key&&timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64));};
const asyncRoute=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{fn(req,res).catch(next);};
export class Auth {
  onLogout?: (userId:string)=>Promise<void>;
  mode=process.env.AUTH_MODE||'local';
  constructor(public store:Store){
    if(process.env.NODE_ENV==='production'&&(this.mode!=='supabase'||!process.env.DATABASE_URL))throw Error('Production requires Supabase Auth and DATABASE_URL.');
    if(this.mode==='supabase'&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY))throw Error('Supabase Auth configuration is missing.');
  }
  supa(){return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
  async user(token:string|undefined){
    if(!token)return null;
    const r=(await this.store.query('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?',[digest(token),Date.now()]))[0];
    if(!r)return null;
    if(this.mode==='supabase'){
      const supa=this.supa();const {data,error}=await supa.auth.getUser(r.access_token);
      if(error||!data.user){
        const refreshed=await supa.auth.refreshSession({refresh_token:r.refresh_token});
        if(refreshed.error||!refreshed.data.session){await this.store.query('DELETE FROM sessions WHERE token_hash=?',[digest(token)]);return null;}
        await this.store.query('UPDATE sessions SET access_token=?,refresh_token=? WHERE token_hash=?',[refreshed.data.session.access_token,refreshed.data.session.refresh_token,digest(token)]);
      }
    }
    return r.user_id as string;
  }
  async session(res:Response,userId:string,access?:string,refresh?:string){
    const token=randomBytes(32).toString('hex');const expires=Date.now()+7*86400000;
    await this.store.query('INSERT INTO sessions(token_hash,user_id,expires_at,access_token,refresh_token) VALUES(?,?,?,?,?)',[digest(token),userId,expires,access||null,refresh||null]);
    res.cookie('etheria_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:7*86400000,path:'/'});
  }
  mount(app:Application){
    app.use('/api/auth',rateLimit({windowMs:15*60000,limit:45,standardHeaders:'draft-8',legacyHeaders:false}));
    app.get('/api/auth/session',asyncRoute(async(req,res)=>{const id=await this.user(req.cookies.etheria_session);res.json({user:id,mode:this.mode,character:id?await this.store.character(id):null});}));
    for(const method of ['register','login']as const)app.post('/api/auth/'+method,asyncRoute(async(req,res)=>{
      const {email,password}=creds.parse(req.body);
      if(this.mode==='supabase'){
        const result=method==='register'?await this.supa().auth.signUp({email,password,options:{emailRedirectTo:process.env.PUBLIC_URL}}):await this.supa().auth.signInWithPassword({email,password});
        if(result.error)throw Error(result.error.message);
        const user=result.data.user;if(!user)throw Error('Autentikasi gagal.');
        await this.store.query('INSERT INTO profiles(id,email,password_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING',[user.id,email,null,Date.now()]);
        if(result.data.session)await this.session(res,user.id,result.data.session.access_token,result.data.session.refresh_token);
        res.json({ok:true,confirmation:!result.data.session});
      }else{
        let user=(await this.store.query('SELECT * FROM profiles WHERE email=?',[email]))[0];
        if(method==='register'){
          if(user)throw Error('Email sudah digunakan.');const id=randomUUID();
          await this.store.query('INSERT INTO profiles(id,email,password_hash,created_at) VALUES(?,?,?,?)',[id,email,passwordHash(password),Date.now()]);user={id};
        }else if(!user?.password_hash||!checkPassword(password,user.password_hash))throw Error('Email atau kata sandi salah.');
        await this.session(res,user.id);res.json({ok:true});
      }
    }));
    app.post('/api/auth/logout',asyncRoute(async(req,res)=>{if(req.cookies.etheria_session){const row=(await this.store.query('SELECT user_id FROM sessions WHERE token_hash=?',[digest(req.cookies.etheria_session)]))[0];if(row)await this.onLogout?.(row.user_id);await this.store.query('DELETE FROM sessions WHERE token_hash=?',[digest(req.cookies.etheria_session)]);}res.clearCookie('etheria_session',{path:'/'});res.json({ok:true});}));
    app.post('/api/auth/reset',asyncRoute(async(req,res)=>{
      const email=z.email().parse(req.body.email);
      if(this.mode!=='supabase')return res.status(409).json({error:'Email reset tersedia setelah Supabase terhubung. Mode lokal tidak memiliki layanan email.'});
      const {error}=await this.supa().auth.resetPasswordForEmail(email,{redirectTo:process.env.PUBLIC_URL+'/?recovery=1'});if(error)throw error;
      res.json({ok:true,message:'Jika akun terdaftar, tautan pemulihan telah dikirim.'});
    }));
    app.post('/api/auth/recover',asyncRoute(async(req,res)=>{
      if(this.mode!=='supabase')throw Error('Supabase diperlukan.');
      const v=z.object({access_token:z.string().min(20).max(8192),refresh_token:z.string().min(5).max(8192),password:z.string().min(8).max(128)}).parse(req.body);
      const supa=this.supa();const {error}=await supa.auth.setSession(v);if(error)throw error;
      const updated=await supa.auth.updateUser({password:v.password});if(updated.error)throw updated.error;
      res.json({ok:true});
    }));
  }
}

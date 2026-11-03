import 'dotenv/config';
import { Store } from './store.js';
import { readFileSync } from 'node:fs';
const store=new Store();await store.init();if(store.pool)await store.pool.query(readFileSync('migrations/002_supabase_security.sql','utf8'));await store.close();console.log('Database migrations applied.');

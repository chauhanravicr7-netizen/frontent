// src/lib/supabase.js
// ── Single Supabase client for all of Dockside ──────────────────
// Import { sb, getCompanyId } into any component that needs data.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── AUTH ─────────────────────────────────────────────────────────
export const signIn  = (email, password) => sb.auth.signInWithPassword({ email, password });
export const signUp  = (email, password) => sb.auth.signUp({ email, password });
export const signOut = () => sb.auth.signOut();

// ── DATA HELPERS (always scoped to company_id) ───────────────────
export const db = {
  inventory: {
    list : (cid) => sb.from('inventory').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
    insert: (row) => sb.from('inventory').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('inventory').update(patch).eq('id', id).eq('company_id', cid).select().single(),
    del   : (id, cid) => sb.from('inventory').delete().eq('id', id).eq('company_id', cid),
  },
  yards: {
    list  : (cid) => sb.from('yards').select('*').eq('company_id', cid),
    insert: (row) => sb.from('yards').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('yards').update(patch).eq('id', id).eq('company_id', cid).select().single(),
  },
  deals: {
    list  : (cid) => sb.from('deals').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
    insert: (row) => sb.from('deals').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('deals').update(patch).eq('id', id).eq('company_id', cid).select().single(),
  },
  shipments: {
    list  : (cid) => sb.from('shipments').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
    insert: (row) => sb.from('shipments').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('shipments').update(patch).eq('id', id).eq('company_id', cid).select().single(),
  },
  suppliers: {
    list  : (cid) => sb.from('suppliers').select('*').eq('company_id', cid),
    insert: (row) => sb.from('suppliers').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('suppliers').update(patch).eq('id', id).eq('company_id', cid).select().single(),
  },
  customers: {
    list  : (cid) => sb.from('customers').select('*').eq('company_id', cid),
    insert: (row) => sb.from('customers').insert([row]).select().single(),
    update: (id, cid, patch) => sb.from('customers').update(patch).eq('id', id).eq('company_id', cid).select().single(),
  },
  company: {
    get   : (cid) => sb.from('company').select('*').eq('id', cid).single(),
    update: (cid, patch) => sb.from('company').update(patch).eq('id', cid).select().single(),
  },
};

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
 * Auto-deduct stock when deal is dispatched
 */
export async function deductStockForDeal(dealId) {
  try {
    // Get deal details
    const { data: deal, error: dealError } = await sb
      .from("deals")
      .select("inventory_id, quantity, id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal || !deal.inventory_id) {
      throw new Error("Deal or inventory not found");
    }

    // Get current inventory
    const { data: inventory, error: invError } = await sb
      .from("inventory")
      .select("available_quantity, id")
      .eq("id", deal.inventory_id)
      .single();

    if (invError || !inventory) {
      throw new Error("Inventory not found");
    }

    const previousQty = inventory.available_quantity || 0;
    const newQty = Math.max(0, previousQty - (deal.quantity || 0));

    // Update inventory
    const { error: updateError } = await sb
      .from("inventory")
      .update({
        available_quantity: newQty,
        deal_status: "Sold",
        linked_deal_id: deal.id,
        last_movement_at: new Date().toISOString(),
      })
      .eq("id", deal.inventory_id);

    if (updateError) throw updateError;

    // Log movement
    await sb.from("stock_movements").insert([
      {
        inventory_id: deal.inventory_id,
        deal_id: deal.id,
        movement_type: "deduction",
        quantity_change: -(deal.quantity || 0),
        previous_quantity: previousQty,
        new_quantity: newQty,
        reason: `Deal ${deal.id} dispatched`,
        created_by: (await sb.auth.getUser()).data.user?.id,
      },
    ]);

    return { success: true, newQuantity: newQty };
  } catch (error) {
    console.error("Stock deduction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore stock when deal is rolled back
 */
export async function restoreStockForDeal(dealId) {
  try {
    const { data: deal, error: dealError } = await sb
      .from("deals")
      .select("inventory_id, quantity, id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal || !deal.inventory_id) return;

    const { data: inventory, error: invError } = await sb
      .from("inventory")
      .select("available_quantity")
      .eq("id", deal.inventory_id)
      .single();

    if (invError || !inventory) return;

    const previousQty = inventory.available_quantity || 0;
    const newQty = previousQty + (deal.quantity || 0);

    await sb
      .from("inventory")
      .update({
        available_quantity: newQty,
        deal_status: "Available",
        linked_deal_id: null,
        last_movement_at: new Date().toISOString(),
      })
      .eq("id", deal.inventory_id);

    // Log movement
    await sb.from("stock_movements").insert([
      {
        inventory_id: deal.inventory_id,
        deal_id: deal.id,
        movement_type: "restoration",
        quantity_change: deal.quantity || 0,
        previous_quantity: previousQty,
        new_quantity: newQty,
        reason: `Deal ${deal.id} rolled back`,
        created_by: (await sb.auth.getUser()).data.user?.id,
      },
    ]);

    return { success: true };
  } catch (error) {
    console.error("Stock restoration error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate profit for admin users
 */
export async function calculateDealProfit(deal, inventory) {
  if (!deal || !inventory) return null;

  const revenue = deal.total_value || deal.negotiated_price * deal.quantity || 0;
  const cost = (inventory.cost_price || 0) * (deal.quantity || 0);
  const profit = revenue - cost;
  const margin = cost > 0 ? ((profit / cost) * 100).toFixed(2) : 0;

  return {
    profit,
    margin,
    revenue,
    cost,
  };
}

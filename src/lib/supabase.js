import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

export const sb = createClient(supabaseUrl, supabaseKey);

export async function signIn(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return await sb.auth.signOut();
}

export const db = {
  async get(table, filters = {}) {
    let query = sb.from(table).select("*");
    Object.entries(filters).forEach(([key, val]) => {
      query = query.eq(key, val);
    });
    return await query;
  },
  async insert(table, data) {
    return await sb.from(table).insert(data);
  },
  async update(table, id, data) {
    return await sb.from(table).update(data).eq("id", id);
  },
  async delete(table, id) {
    return await sb.from(table).delete().eq("id", id);
  },
};

export async function deductStockForDeal(dealId) {
  try {
    const { data: deal, error: dealError } = await sb
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .single();

    if (dealError) throw dealError;
    if (!deal || !deal.inventory_id) return { success: false, error: "No inventory linked" };

    const { data: inventory, error: invError } = await sb
      .from("inventory")
      .select("*")
      .eq("id", deal.inventory_id)
      .single();

    if (invError) throw invError;

    const previousQty = inventory.available_quantity || 0;
    const deductQty = parseFloat(deal.quantity) || 0;
    const newQty = Math.max(0, previousQty - deductQty);

    const { error: updateError } = await sb
      .from("inventory")
      .update({
        available_quantity: newQty,
        deal_status: "Sold",
        linked_deal_id: dealId,
        last_movement_at: new Date().toISOString(),
      })
      .eq("id", deal.inventory_id);

    if (updateError) throw updateError;

    await sb.from("stock_movements").insert([{
      inventory_id: deal.inventory_id,
      deal_id: dealId,
      movement_type: "deduction",
      quantity_change: -deductQty,
      previous_quantity: previousQty,
      new_quantity: newQty,
      reason: "Deal dispatched",
      created_at: new Date().toISOString(),
    }]);

    return { success: true };
  } catch (error) {
    console.error("Stock deduction failed:", error);
    return { success: false, error: error.message };
  }
}

export async function restoreStockForDeal(dealId) {
  try {
    const { data: deal, error: dealError } = await sb
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .single();

    if (dealError) throw dealError;
    if (!deal || !deal.inventory_id) return { success: false, error: "No inventory linked" };

    const { data: inventory, error: invError } = await sb
      .from("inventory")
      .select("*")
      .eq("id", deal.inventory_id)
      .single();

    if (invError) throw invError;

    const previousQty = inventory.available_quantity || 0;
    const restoreQty = parseFloat(deal.quantity) || 0;
    const newQty = previousQty + restoreQty;

    const { error: updateError } = await sb
      .from("inventory")
      .update({
        available_quantity: newQty,
        deal_status: "Available",
        linked_deal_id: null,
        last_movement_at: new Date().toISOString(),
      })
      .eq("id", deal.inventory_id);

    if (updateError) throw updateError;

    await sb.from("stock_movements").insert([{
      inventory_id: deal.inventory_id,
      deal_id: dealId,
      movement_type: "restoration",
      quantity_change: restoreQty,
      previous_quantity: previousQty,
      new_quantity: newQty,
      reason: "Deal stage rolled back",
      created_at: new Date().toISOString(),
    }]);

    return { success: true };
  } catch (error) {
    console.error("Stock restoration failed:", error);
    return { success: false, error: error.message };
  }
}

export function calculateDealProfit(deal, inventory) {
  if (!deal || !deal.inventory_id || !inventory) {
    return { profit: 0, margin: 0, revenue: 0, cost: 0 };
  }

  const item = inventory.find(i => i.id === deal.inventory_id);
  if (!item) {
    return { profit: 0, margin: 0, revenue: 0, cost: 0 };
  }

  const revenue = deal.total_value || 0;
  const cost = (item.cost_price || 0) * (deal.quantity || 0);
  const profit = revenue - cost;
  const margin = cost > 0 ? ((profit / cost) * 100).toFixed(1) : "0.0";

  return { profit, margin, revenue, cost };
}

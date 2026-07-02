"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Capa de datos que replica la API de entidades de Base44 sobre Supabase.
 *
 * Por cada entidad:
 *   Entity.list(orderBy?, limit?)
 *   Entity.filter(conditions, orderBy?, limit?)
 *   Entity.get(id)
 *   Entity.create(data)
 *   Entity.update(id, data)
 *   Entity.delete(id)
 *   Entity.subscribe(callback)   -> Supabase Realtime, devuelve unsubscribe
 *
 * Convenciones Base44 conservadas en el esquema: id, created_date, updated_date,
 * created_by, created_by_id; orden por defecto "-created_date".
 */

export const supabase = createClient();

function applyOrder(query, orderBy) {
  if (!orderBy) return query;
  const desc = orderBy.startsWith("-");
  const column = desc ? orderBy.slice(1) : orderBy;
  return query.order(column, { ascending: !desc });
}

let channelSeq = 0;

export function createEntity(table) {
  return {
    table,

    async list(orderBy = "-created_date", limit) {
      let query = supabase.from(table).select("*");
      query = applyOrder(query, orderBy);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(conditions = {}, orderBy = "-created_date", limit) {
      let query = supabase.from(table).select("*");
      for (const [key, value] of Object.entries(conditions)) {
        if (Array.isArray(value)) query = query.in(key, value);
        else query = query.eq(key, value);
      }
      query = applyOrder(query, orderBy);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },

    async create(values) {
      const { data, error } = await supabase
        .from(table)
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, values) {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    },

    /**
     * Suscripción Realtime estilo Base44.
     * callback recibe { type: 'create'|'update'|'delete', data, id }.
     * Devuelve una función para cancelar la suscripción.
     */
    subscribe(callback) {
      channelSeq += 1;
      const channel = supabase
        .channel(`realtime:${table}:${channelSeq}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            const type =
              payload.eventType === "INSERT"
                ? "create"
                : payload.eventType === "UPDATE"
                ? "update"
                : "delete";
            const data =
              payload.new && Object.keys(payload.new).length
                ? payload.new
                : payload.old;
            callback({ type, data, id: data?.id });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

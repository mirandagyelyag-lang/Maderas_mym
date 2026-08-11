import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const LorebooksContext = createContext();

export function LorebooksProvider({ children }) {
  const { user } = useAuth();
  const [lorebooks, setLorebooks] = useState([]);
  const [lorebooksLoading, setLorebooksLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLorebooks([]); setLorebooksLoading(false); return; }
    loadLorebooks();
  }, [user?.id]);

  async function loadLorebooks() {
    try {
      setLorebooksLoading(true);
      const { data, error } = await supabase.from("lorebooks").select("*, lore_entries(count)").order("updated_at", { ascending: false });
      if (error) throw error;
      setLorebooks((data || []).map(convertLorebook));
    } finally { setLorebooksLoading(false); }
  }

  async function saveLorebook(form, lorebookId = null) {
    const payload = { user_id: user.id, name: form.name.trim(), description: form.description?.trim() || null, genre: form.genre?.trim() || null, color: form.color || "#7a2942", updated_at: new Date().toISOString() };
    const request = lorebookId ? supabase.from("lorebooks").update(payload).eq("id", lorebookId) : supabase.from("lorebooks").insert(payload);
    const { data, error } = await request.select().single();
    if (error) throw error;
    const saved = convertLorebook(data);
    setLorebooks((current) => lorebookId ? current.map((item) => item.id === lorebookId ? { ...saved, entryCount: item.entryCount } : item) : [{ ...saved, entryCount: 0 }, ...current]);
    return saved;
  }

  async function deleteLorebook(id) {
    const { error } = await supabase.from("lorebooks").delete().eq("id", id);
    if (error) throw error;
    setLorebooks((current) => current.filter((item) => item.id !== id));
  }

  async function loadEntries(lorebookId) {
    const { data, error } = await supabase.from("lore_entries").select("*").eq("lorebook_id", lorebookId).order("entry_type").order("updated_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(convertEntry);
  }

  async function saveEntry(lorebookId, form, entryId = null) {
    const payload = { lorebook_id: lorebookId, user_id: user.id, entry_type: form.entryType, name: form.name.trim(), content: form.content.trim(), keywords: parseKeywords(form.keywords), event_date: form.entryType === "event" ? form.eventDate?.trim() || null : null, is_active: Boolean(form.isActive), always_include: Boolean(form.alwaysInclude), updated_at: new Date().toISOString() };
    const request = entryId ? supabase.from("lore_entries").update(payload).eq("id", entryId) : supabase.from("lore_entries").insert(payload);
    const { data, error } = await request.select().single();
    if (error) throw error;
    if (!entryId) setLorebooks((current) => current.map((item) => item.id === lorebookId ? { ...item, entryCount: item.entryCount + 1 } : item));
    return convertEntry(data);
  }

  async function deleteEntry(lorebookId, entryId) {
    const { error } = await supabase.from("lore_entries").delete().eq("id", entryId);
    if (error) throw error;
    setLorebooks((current) => current.map((item) => item.id === lorebookId ? { ...item, entryCount: Math.max(0, item.entryCount - 1) } : item));
  }

  async function toggleEntry(entryId, active) {
    const { data, error } = await supabase.from("lore_entries").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", entryId).select().single();
    if (error) throw error;
    return convertEntry(data);
  }

  return <LorebooksContext.Provider value={{ lorebooks, lorebooksLoading, loadLorebooks, saveLorebook, deleteLorebook, loadEntries, saveEntry, deleteEntry, toggleEntry }}>{children}</LorebooksContext.Provider>;
}

function parseKeywords(value = "") { return [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 20); }
function convertLorebook(row) { return { id: row.id, name: row.name, description: row.description || "", genre: row.genre || "", color: row.color || "#7a2942", entryCount: row.lore_entries?.[0]?.count || 0, createdAt: row.created_at, updatedAt: row.updated_at }; }
function convertEntry(row) { return { id: row.id, lorebookId: row.lorebook_id, entryType: row.entry_type, name: row.name, content: row.content, keywords: (row.keywords || []).join(", "), eventDate: row.event_date || "", isActive: Boolean(row.is_active), alwaysInclude: Boolean(row.always_include), createdAt: row.created_at, updatedAt: row.updated_at }; }

export function useLorebooks() { const context = useContext(LorebooksContext); if (!context) throw new Error("useLorebooks must be used inside LorebooksProvider"); return context; }

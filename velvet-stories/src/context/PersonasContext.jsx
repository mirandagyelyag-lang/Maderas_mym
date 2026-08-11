import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const PersonasContext = createContext();

export function PersonasProvider({ children }) {
  const { user } = useAuth();
  const [personas, setPersonas] = useState([]);
  const [personasLoading, setPersonasLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPersonas([]); setPersonasLoading(false); return; }
    loadPersonas();
  }, [user?.id]);

  async function loadPersonas() {
    try {
      setPersonasLoading(true);
      const { data, error } = await supabase.from("personas").select("*")
        .order("is_default", { ascending: false }).order("updated_at", { ascending: false });
      if (error) throw error;
      setPersonas((data || []).map(convertPersona));
    } finally { setPersonasLoading(false); }
  }

  async function savePersona(form, personaId = null) {
    if (!user) throw new Error("You need to sign in.");
    const imageUrl = form.imageFile ? await uploadImage(form.imageFile) : form.imageUrl || null;
    const payload = {
      user_id: user.id, name: form.name.trim(), pronouns: clean(form.pronouns), age: clean(form.age),
      role: clean(form.role), appearance: clean(form.appearance), personality: clean(form.personality),
      background: clean(form.background), goals: clean(form.goals), preferences: clean(form.preferences),
      boundaries: clean(form.boundaries), speech_style: clean(form.speechStyle), notes: clean(form.notes), image_url: imageUrl,
      color: form.color || "#7a2942", is_default: Boolean(form.isDefault), updated_at: new Date().toISOString(),
    };

    if (payload.is_default) {
      const query = supabase.from("personas").update({ is_default: false }).eq("user_id", user.id);
      if (personaId) query.neq("id", personaId);
      const { error } = await query;
      if (error) throw error;
    }

    const request = personaId
      ? supabase.from("personas").update(payload).eq("id", personaId)
      : supabase.from("personas").insert(payload);
    const { data, error } = await request.select().single();
    if (error) throw error;
    const saved = convertPersona(data);
    setPersonas((current) => {
      const updated = personaId ? current.map((item) => item.id === personaId ? saved : { ...item, isDefault: payload.is_default ? false : item.isDefault }) : [saved, ...current.map((item) => ({ ...item, isDefault: payload.is_default ? false : item.isDefault }))];
      return updated.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    });
    return saved;
  }

  async function deletePersona(personaId) {
    const { error } = await supabase.from("personas").delete().eq("id", personaId);
    if (error) throw error;
    setPersonas((current) => current.filter((item) => item.id !== personaId));
  }

  async function uploadImage(file) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}-persona.${extension}`;
    const { error } = await supabase.storage.from("persona-media").upload(path, file, { cacheControl: "3600" });
    if (error) throw error;
    return supabase.storage.from("persona-media").getPublicUrl(path).data.publicUrl;
  }

  return <PersonasContext.Provider value={{ personas, personasLoading, loadPersonas, savePersona, deletePersona }}>{children}</PersonasContext.Provider>;
}

function clean(value) { return value?.trim() || null; }
function convertPersona(row) {
  return { id: row.id, name: row.name, pronouns: row.pronouns || "", age: row.age || "", role: row.role || "", appearance: row.appearance || "", personality: row.personality || "", background: row.background || "", goals: row.goals || "", preferences: row.preferences || "", boundaries: row.boundaries || "", speechStyle: row.speech_style || "", notes: row.notes || "", imageUrl: row.image_url || "", color: row.color || "#7a2942", isDefault: Boolean(row.is_default), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function usePersonas() {
  const context = useContext(PersonasContext);
  if (!context) throw new Error("usePersonas must be used inside PersonasProvider");
  return context;
}

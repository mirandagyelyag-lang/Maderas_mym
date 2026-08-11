import { Brain, Check, ChevronDown, LoaderCircle, Pencil, Pin, PinOff, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCharacters } from "../context/CharactersContext";
import { supabase } from "../services/supabase";
import { useFeedback } from "../context/FeedbackContext";
import "../styles/memories.css";

const categories = [
  { id: "all", label: "All memories" },
  { id: "person", label: "About you" },
  { id: "relationship", label: "Relationship" },
  { id: "world", label: "World" },
  { id: "event", label: "Events" },
  { id: "preference", label: "Preferences" },
  { id: "boundary", label: "Boundaries" },
];

const emptyDraft = { content: "", category: "event", importance: 3, isPinned: true, scope: "character" };

function Memories({ onBrowseCharacters, onOpenCharacter }) {
  const { confirmAction, scheduleDeletion } = useFeedback();
  const { user } = useAuth();
  const { characters } = useCharacters();
  const [memories, setMemories] = useState([]);
  const [conversationByCharacter, setConversationByCharacter] = useState(new Map());
  const [selectedCharacterId, setSelectedCharacterId] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftCharacterId, setDraftCharacterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  useEffect(() => { loadMemories(); }, [user?.id, characters.length]);

  async function loadMemories() {
    if (!user) return;
    try {
      setLoading(true); setError("");
      const [{ data: memoryRows, error: memoryError }, { data: conversations, error: conversationError }] = await Promise.all([
        supabase.from("memories").select("*").order("is_pinned", { ascending: false }).order("importance", { ascending: false }).order("updated_at", { ascending: false }),
        supabase.from("conversations").select("id, character_id, updated_at").order("updated_at", { ascending: false }),
      ]);
      if (memoryError) throw memoryError;
      if (conversationError) throw conversationError;

      const map = new Map();
      (conversations || []).forEach((conversation) => {
        if (!map.has(conversation.character_id)) map.set(conversation.character_id, conversation.id);
      });
      setConversationByCharacter(map);
      setMemories((memoryRows || []).map((memory) => ({ ...memory, character: characters.find((item) => item.id === memory.character_id) })));
    } catch (requestError) {
      console.error("Error loading memories:", requestError);
      setError("We couldn't load your memories.");
    } finally { setLoading(false); }
  }

  function openCreate() {
    const characterId = selectedCharacterId !== "all" ? selectedCharacterId : characters[0]?.id || "";
    setEditingMemory(null); setDraft(emptyDraft); setDraftCharacterId(characterId); setError(""); setEditorOpen(true);
  }

  function openEdit(memory) {
    setEditingMemory(memory);
    setDraft({ content: memory.content, category: memory.category || "event", importance: memory.importance || 3, isPinned: Boolean(memory.is_pinned), scope: memory.scope || "conversation" });
    setDraftCharacterId(memory.character_id); setError(""); setEditorOpen(true);
  }

  async function saveMemory(event) {
    event.preventDefault();
    const content = draft.content.trim();
    if (!content || !draftCharacterId) return;
    const duplicate = memories.some((memory) => memory.id !== editingMemory?.id && memory.character_id === draftCharacterId && normalize(memory.content) === normalize(content));
    if (duplicate) return setError("That character already remembers this. Edit the existing memory instead.");

    try {
      setSaving(true); setError("");
      const payload = {
        content, category: draft.category, importance: Number(draft.importance), is_pinned: draft.isPinned, scope: draft.scope,
        updated_at: new Date().toISOString(), source: "manual",
      };
      let saved;
      if (editingMemory) {
        const { data, error: requestError } = await supabase.from("memories").update(payload).eq("id", editingMemory.id).select().single();
        if (requestError) throw requestError;
        saved = data;
        setMemories((current) => current.map((item) => item.id === saved.id ? { ...saved, character: item.character } : item).sort(sortMemories));
      } else {
        const conversationId = conversationByCharacter.get(draftCharacterId);
        if (!conversationId) throw new Error("Start a conversation with this character before adding memories.");
        const { data, error: requestError } = await supabase.from("memories").insert({
          ...payload, conversation_id: conversationId, character_id: draftCharacterId, user_id: user.id,
        }).select().single();
        if (requestError) throw requestError;
        saved = data;
        setMemories((current) => [{ ...saved, character: characters.find((item) => item.id === saved.character_id) }, ...current].sort(sortMemories));
      }
      setEditorOpen(false);
    } catch (requestError) {
      console.error("Error saving memory:", requestError);
      setError(requestError.message || "We couldn't save this memory.");
    } finally { setSaving(false); }
  }

  async function togglePinned(memory) {
    try {
      setWorkingId(memory.id);
      const isPinned = !memory.is_pinned;
      const { error: requestError } = await supabase.from("memories").update({ is_pinned: isPinned, updated_at: new Date().toISOString() }).eq("id", memory.id);
      if (requestError) throw requestError;
      setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, is_pinned: isPinned } : item).sort(sortMemories));
    } catch (requestError) { setError(requestError.message); }
    finally { setWorkingId(null); }
  }

  async function deleteMemory(memory) {
    if (!await confirmAction({ title: "Delete this memory?", message: "The character will no longer receive this fact as long-term context.", confirmLabel: "Delete memory" })) return;
    scheduleDeletion({ message: "Deleting memory", onCommit: async () => { setWorkingId(memory.id); const { error: requestError } = await supabase.from("memories").delete().eq("id", memory.id); if (requestError) throw requestError; setMemories((current) => current.filter((item) => item.id !== memory.id)); setWorkingId(null); }, onError: (requestError) => { setWorkingId(null); setError(requestError.message); } });
  }

  const filtered = useMemo(() => memories.filter((memory) => {
    if (selectedCharacterId !== "all" && memory.character_id !== selectedCharacterId) return false;
    if (category !== "all" && memory.category !== category) return false;
    return !search.trim() || `${memory.content} ${memory.character?.name || ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [memories, selectedCharacterId, category, search]);

  return <section className="memories-page">
    <header className="page-heading memories-page__heading">
      <div><p>LONG-TERM MEMORY</p><h1>Memories</h1><span>Choose what your characters remember—and what they forget.</span></div>
      <button className="memories-page__add" onClick={openCreate} disabled={!characters.length}><Plus size={18} />Add memory</button>
    </header>

    {error && !editorOpen && <div className="memories-page__notice"><Sparkles size={17} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}

    {characters.length > 0 && <div className="memory-toolbar">
      <label className="memory-toolbar__search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memories..." /></label>
      <label className="memory-toolbar__select"><select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}><option value="all">All characters</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><ChevronDown size={17} /></label>
    </div>}

    {characters.length > 0 && <div className="memory-categories">{categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>}

    {loading && <div className="page-state"><LoaderCircle className="spin" size={28} /><p>Opening the memory vault...</p></div>}
    {!loading && characters.length === 0 && <div className="page-state page-state--empty"><span><Brain size={28} /></span><h2>No characters yet</h2><p>Create someone before giving them long-term memories.</p><button onClick={onBrowseCharacters}>Create a character</button></div>}
    {!loading && characters.length > 0 && memories.length === 0 && <div className="page-state page-state--empty"><span><Brain size={28} /></span><h2>The memory vault is empty</h2><p>Memories will appear automatically as stories develop, or you can add one yourself.</p><button onClick={openCreate}>Add the first memory</button></div>}
    {!loading && memories.length > 0 && filtered.length === 0 && <div className="page-state"><Search size={27} /><p>No memories match these filters.</p></div>}

    {!loading && filtered.length > 0 && <div className="memory-grid">{filtered.map((memory) => <MemoryCard key={memory.id} memory={memory} busy={workingId === memory.id} onPin={() => togglePinned(memory)} onEdit={() => openEdit(memory)} onDelete={() => deleteMemory(memory)} onOpenCharacter={onOpenCharacter} />)}</div>}

    {editorOpen && <div className="memory-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditorOpen(false)}>
      <form className="memory-editor" onSubmit={saveMemory}>
        <header><div><p>MEMORY VAULT</p><h2>{editingMemory ? "Refine this memory" : "Add something important"}</h2></div><button type="button" onClick={() => setEditorOpen(false)} disabled={saving}><X size={20} /></button></header>
        {!editingMemory && <label>Character<select value={draftCharacterId} onChange={(event) => setDraftCharacterId(event.target.value)} disabled={saving}><option value="">Choose a character</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>}
        <label>What should they remember?<textarea value={draft.content} onChange={(event) => { setDraft((current) => ({ ...current, content: event.target.value })); setError(""); }} maxLength={500} rows="5" placeholder="Antonia dislikes being pressured to drink and Alexander respects that boundary." autoFocus disabled={saving} /><small>{draft.content.length}/500</small></label>
        <div className="memory-editor__row"><label>Category<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categories.slice(1).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Importance<select value={draft.importance} onChange={(event) => setDraft((current) => ({ ...current, importance: event.target.value }))}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} · {importanceLabel(value)}</option>)}</select></label></div>
        <label>Memory scope<select value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))}><option value="conversation">This story only</option><option value="character">All stories with this character</option></select><small>Use “all stories” only for facts that belong to the character across different timelines.</small></label>
                <label className="memory-editor__pin"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft((current) => ({ ...current, isPinned: event.target.checked }))} /><span><Pin size={17} /><strong>Never forget this</strong><small>Pinned memories are always shown to the character first.</small></span></label>
        {error && <p className="memory-editor__error">{error}</p>}
        <footer><button type="button" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving || !draft.content.trim() || !draftCharacterId}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{saving ? "Saving..." : "Save memory"}</button></footer>
      </form>
    </div>}
  </section>;
}

function MemoryCard({ memory, busy, onPin, onEdit, onDelete, onOpenCharacter }) {
  const character = memory.character;
  return <article className={`memory-card${memory.is_pinned ? " memory-card--pinned" : ""}`}>
    <header><button className="memory-card__character" onClick={() => character && onOpenCharacter(character)}><span style={{ "--character-color": character?.color }}>{character?.imageUrl ? <img src={character.imageUrl} alt="" /> : character?.initials || "?"}</span><span><strong>{character?.name || "Unknown character"}</strong><small>{memory.source === "manual" ? "Saved by you" : "Learned automatically"}{memory.scope === "character" ? " · all stories" : " · this story"}</small></span></button><span className={`memory-card__category memory-card__category--${memory.category}`}>{categoryLabel(memory.category)}</span></header>
    <p>{memory.content}</p>
    <footer><span>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < memory.importance ? "filled" : ""} />)}</span><div><button onClick={onPin} disabled={busy} aria-label={memory.is_pinned ? "Unpin" : "Pin"}>{memory.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}</button><button onClick={onEdit} disabled={busy} aria-label="Edit"><Pencil size={16} /></button><button className="danger" onClick={onDelete} disabled={busy} aria-label="Delete">{busy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button></div></footer>
  </article>;
}

function sortMemories(a, b) { if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1; return (b.importance || 0) - (a.importance || 0) || new Date(b.updated_at) - new Date(a.updated_at); }
function normalize(value) { return value.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, " ").trim(); }
function categoryLabel(value) { return categories.find((item) => item.id === value)?.label || "Event"; }
function importanceLabel(value) { return ({ 1: "Minor", 2: "Useful", 3: "Important", 4: "Major", 5: "Essential" })[value]; }

export default Memories;

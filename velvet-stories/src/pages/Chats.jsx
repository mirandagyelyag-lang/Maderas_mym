import { Archive, ArchiveRestore, BookOpen, Check, Copy, Download, GitBranch, LoaderCircle, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCharacters } from "../context/CharactersContext";
import { useChats } from "../context/ChatsContext";
import { supabase } from "../services/supabase";
import { useSettings } from "../context/SettingsContext";
import { useFeedback } from "../context/FeedbackContext";
import "../styles/chats.css";

function Chats({ onOpenCharacter, onBrowseCharacters }) {
  const { user } = useAuth();
  const { characters } = useCharacters();
  const { createNewConversation } = useChats();
  const { settings } = useSettings();
  const { confirmAction, scheduleDeletion } = useFeedback();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingId, setCreatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [view, setView] = useState("active");
  const [pendingDeletionIds, setPendingDeletionIds] = useState([]);
  const [menuId, setMenuId] = useState(null);

  useEffect(() => { loadConversations(); }, [user?.id, characters.length]);

  async function loadConversations() {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      const { data: rows, error: conversationError } = await supabase
        .from("conversations").select("*")
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (conversationError) throw conversationError;

      const ids = (rows || []).map((row) => row.id);
      let messages = [];
      if (ids.length) {
        const { data, error: messagesError } = await supabase
          .from("messages").select("conversation_id, content, sender, created_at")
          .in("conversation_id", ids).order("created_at", { ascending: false });
        if (messagesError) throw messagesError;
        messages = data || [];
      }

      const latestByConversation = new Map();
      messages.forEach((item) => {
        if (!latestByConversation.has(item.conversation_id)) latestByConversation.set(item.conversation_id, item);
      });
      setConversations((rows || []).map((row) => ({
        ...row,
        character: characters.find((item) => item.id === row.character_id),
        latestMessage: latestByConversation.get(row.id),
      })));
    } catch (requestError) {
      console.error("Error loading conversations:", requestError);
      setError("We couldn't load your conversations.");
    } finally { setLoading(false); }
  }

  async function handleCreate(character) {
    try {
      setCreatingId(character.id);
      setError("");
      const chat = await createNewConversation(character);
      setPickerOpen(false);
      onOpenCharacter(character, chat.conversationId);
    } catch (requestError) {
      console.error("Error creating conversation:", requestError);
      setError("We couldn't create a new conversation.");
    } finally { setCreatingId(null); }
  }

  async function togglePinned(event, conversation) {
    event.stopPropagation();
    try {
      setUpdatingId(conversation.id);
      const isPinned = !conversation.is_pinned;
      const { error: requestError } = await supabase.from("conversations")
        .update({ is_pinned: isPinned }).eq("id", conversation.id);
      if (requestError) throw requestError;
      setConversations((current) => current
        .map((item) => item.id === conversation.id ? { ...item, is_pinned: isPinned } : item)
        .sort(sortConversations));
    } catch (requestError) {
      console.error("Error pinning conversation:", requestError);
      setError("We couldn't update that conversation.");
    } finally { setUpdatingId(null); }
  }

  function beginRename(event, conversation) {
    event.stopPropagation();
    setEditingId(conversation.id);
    setEditTitle(conversation.title || conversation.character?.name || "");
  }

  async function saveTitle(event, conversation) {
    event.preventDefault();
    event.stopPropagation();
    const title = editTitle.trim();
    if (!title) return;
    try {
      setUpdatingId(conversation.id);
      const { error: requestError } = await supabase.from("conversations")
        .update({ title }).eq("id", conversation.id);
      if (requestError) throw requestError;
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, title } : item));
      setEditingId(null);
    } catch (requestError) {
      console.error("Error renaming conversation:", requestError);
      setError("We couldn't rename that conversation.");
    } finally { setUpdatingId(null); }
  }

  async function deleteConversation(event, conversationId) {
    event.stopPropagation();
    const conversation = conversations.find((item) => item.id === conversationId);
    const approved = !settings.confirmBeforeDelete || await confirmAction({ title: "Delete this conversation?", message: "Its messages and alternatives will also be removed after the Undo period.", confirmLabel: "Delete story" });
    if (!approved) return;
    setPendingDeletionIds((current) => [...current, conversationId]);
    scheduleDeletion({
      message: `Deleting ${conversation?.title || conversation?.character?.name || "conversation"}`,
      onUndo: () => setPendingDeletionIds((current) => current.filter((id) => id !== conversationId)),
      onCommit: async () => {
        setDeletingId(conversationId);
        const { error: requestError } = await supabase.from("conversations").delete().eq("id", conversationId);
        if (requestError) throw requestError;
        setConversations((current) => current.filter((item) => item.id !== conversationId));
        setPendingDeletionIds((current) => current.filter((id) => id !== conversationId));
        setDeletingId(null);
      },
      onError: (requestError) => { console.error(requestError); setPendingDeletionIds((current) => current.filter((id) => id !== conversationId)); setError("We couldn't delete that conversation."); setDeletingId(null); },
    });
  }

  async function duplicateConversation(event, conversation) {
    event.stopPropagation();
    try {
      setUpdatingId(conversation.id);
      setError("");
      const { data: created, error: createError } = await supabase.from("conversations").insert({
        user_id: user.id,
        character_id: conversation.character_id,
        title: `${conversation.title || conversation.character?.name || "Story"} · copy`.slice(0, 80),
        persona_id: conversation.persona_id || null,
        lorebook_id: conversation.lorebook_id || null,
        response_length_override: conversation.response_length_override || null,
        narration_style_override: conversation.narration_style_override || null,
        creativity: conversation.creativity ?? 0.84,
        romance_intensity: conversation.romance_intensity ?? 35,
        initiative: conversation.initiative ?? 65,
        drama: conversation.drama ?? 45,
        flirting: conversation.flirting ?? 30,
        humor: conversation.humor ?? 45,
        description_level: conversation.description_level ?? 55,
        character_independence: conversation.character_independence ?? 80,
        dialogue_frequency: conversation.dialogue_frequency ?? 55,
        narrative_camera: conversation.narrative_camera || "balanced",
        inner_thoughts: conversation.inner_thoughts || "rare",
        story_preset: conversation.story_preset || "natural",
        scene_state: conversation.scene_state || {},
        story_timeline: conversation.story_timeline || [],
        branch_parent_id: conversation.id,
        branch_label: "Duplicate",
      }).select().single();
      if (createError) throw createError;

      const [{ data: sourceMessages, error: messagesError }, { data: sourceMemories, error: memoriesError }] = await Promise.all([
        supabase.from("messages").select("sender, content, edited_at").eq("conversation_id", conversation.id).order("created_at", { ascending: true }),
        supabase.from("memories").select("content, importance, category, is_pinned, source").eq("conversation_id", conversation.id).eq("scope", "conversation"),
      ]);
      if (messagesError) throw messagesError;
      if (memoriesError) throw memoriesError;

      if (sourceMessages?.length) {
        const now = Date.now();
        const { error: copyError } = await supabase.from("messages").insert(sourceMessages.map((message, index) => ({
          conversation_id: created.id, user_id: user.id, sender: message.sender, content: message.content, edited_at: message.edited_at || null, created_at: new Date(now + index).toISOString(),
        })));
        if (copyError) throw copyError;
      }

      if (sourceMemories?.length) {
        const { error: memoryCopyError } = await supabase.from("memories").insert(sourceMemories.map((memory) => ({
          conversation_id: created.id, character_id: conversation.character_id, user_id: user.id, content: memory.content, importance: memory.importance, category: memory.category, is_pinned: memory.is_pinned, source: memory.source, scope: "conversation",
        })));
        if (memoryCopyError) console.warn("Could not copy timeline memories:", memoryCopyError);
      }

      await loadConversations();
    } catch (requestError) {
      console.error("Error duplicating conversation:", requestError);
      setError("We couldn't duplicate that conversation.");
    } finally { setUpdatingId(null); }
  }

  async function toggleArchived(event, conversation) {
    event.stopPropagation();
    try {
      setUpdatingId(conversation.id);
      const archivedAt = conversation.archived_at ? null : new Date().toISOString();
      const { error: requestError } = await supabase.from("conversations").update({ archived_at: archivedAt, is_pinned: archivedAt ? false : conversation.is_pinned }).eq("id", conversation.id);
      if (requestError) throw requestError;
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, archived_at: archivedAt, is_pinned: archivedAt ? false : item.is_pinned } : item));
    } catch (requestError) { console.error(requestError); setError("We couldn't update the archive."); }
    finally { setUpdatingId(null); }
  }

  async function exportConversation(event, conversation) {
    event.stopPropagation();
    try {
      setUpdatingId(conversation.id);
      const { data, error: requestError } = await supabase.from("messages").select("sender, content, created_at").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      if (requestError) throw requestError;
      downloadStory(conversation, data || [], settings.exportFormat);
    } catch (requestError) { console.error(requestError); setError("We couldn't export this story."); }
    finally { setUpdatingId(null); }
  }

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (pendingDeletionIds.includes(conversation.id)) return false;
      if (view === "active" && conversation.archived_at) return false;
      if (view === "archived" && !conversation.archived_at) return false;
      if (!value) return true;
      const character = conversation.character;
      return `${conversation.title || ""} ${character?.name || ""} ${character?.role || ""} ${conversation.latestMessage?.content || ""}`
        .toLowerCase().includes(value);
    });
  }, [conversations, search, view, pendingDeletionIds]);

  const pinnedStories = filtered.filter((conversation) => conversation.is_pinned);
  const recentStories = filtered.filter((conversation) => !conversation.is_pinned);

  function renderStoryCard(conversation) {
    const character = conversation.character;
    if (!character) return null;
    const title = conversation.title || character.name;
    const preview = cleanPreview(conversation.latestMessage?.content || character.firstMessage);
    const menuOpen = menuId === conversation.id;

    return (
      <article
        key={conversation.id}
        className={`story-shelf-card${conversation.is_pinned ? " story-shelf-card--pinned" : ""}`}
        onClick={() => editingId !== conversation.id && onOpenCharacter(character, conversation.id)}
        style={{ "--character-color": character.color }}
      >
        <div className="story-shelf-card__cover">
          {character.coverUrl ? <img src={character.coverUrl} alt="" /> : <div className="story-shelf-card__cover-fallback" />}
          <div className="story-shelf-card__veil" />

          <div className="story-shelf-card__topline">
            <div className="story-shelf-card__badges">
              {conversation.is_pinned && <span><Pin size={11}/>Pinned</span>}
              {conversation.branch_parent_id && <span><GitBranch size={11}/>Branch</span>}
            </div>
            <div className="story-shelf-card__menu-wrap" onClick={(event) => event.stopPropagation()}>
              <button
                className="story-shelf-card__menu-button"
                onClick={() => setMenuId((current) => current === conversation.id ? null : conversation.id)}
                aria-label={`Story actions for ${title}`}
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18}/>
              </button>
              {menuOpen && (
                <div className="story-shelf-card__menu">
                  <button onClick={(event) => { setMenuId(null); togglePinned(event, conversation); }}>{conversation.is_pinned ? <PinOff size={15}/> : <Pin size={15}/>}<span>{conversation.is_pinned ? "Unpin" : "Pin"}</span></button>
                  <button onClick={(event) => { setMenuId(null); beginRename(event, conversation); }}><Pencil size={15}/><span>Rename</span></button>
                  <button onClick={(event) => { setMenuId(null); duplicateConversation(event, conversation); }} disabled={updatingId === conversation.id}><Copy size={15}/><span>Duplicate</span></button>
                  <button onClick={(event) => { setMenuId(null); exportConversation(event, conversation); }} disabled={updatingId === conversation.id}><Download size={15}/><span>Export</span></button>
                  <button onClick={(event) => { setMenuId(null); toggleArchived(event, conversation); }} disabled={updatingId === conversation.id}>{conversation.archived_at ? <ArchiveRestore size={15}/> : <Archive size={15}/>}<span>{conversation.archived_at ? "Restore" : "Archive"}</span></button>
                  <span className="story-shelf-card__menu-separator" />
                  <button className="danger" onClick={(event) => { setMenuId(null); deleteConversation(event, conversation.id); }} disabled={deletingId === conversation.id}>{deletingId === conversation.id ? <LoaderCircle className="spin" size={15}/> : <Trash2 size={15}/>}<span>Delete</span></button>
                </div>
              )}
            </div>
          </div>

          <div className="story-shelf-card__identity">
            <span className="story-shelf-card__avatar">
              {character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.initials}
            </span>
            <div>
              <small>STORY WITH</small>
              <strong>{character.name}</strong>
            </div>
          </div>
        </div>

        <div className="story-shelf-card__body">
          {editingId === conversation.id ? (
            <form className="story-shelf-card__rename" onSubmit={(event) => saveTitle(event, conversation)} onClick={(event) => event.stopPropagation()}>
              <input autoFocus value={editTitle} maxLength={80} onChange={(event) => setEditTitle(event.target.value)} />
              <button type="submit" disabled={!editTitle.trim() || updatingId === conversation.id} aria-label="Save title"><Check size={16}/></button>
              <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename"><X size={16}/></button>
            </form>
          ) : (
            <>
              <h3>{title}</h3>
              <p className="story-shelf-card__role">{character.role || "Character"}</p>
            </>
          )}

          <p className="story-shelf-card__preview">{preview || "Open the story to continue."}</p>

          <div className="story-shelf-card__bottom">
            <time>{formatDate(conversation.updated_at)}</time>
            <span className="story-shelf-card__continue"><BookOpen size={14}/> Continue</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="chats-page chats-page--shelf">
      <header className="story-library-header">
        <div>
          <span className="story-library-header__eyebrow"><Sparkles size={13}/> PRIVATE LIBRARY</span>
          <h1>Stories</h1>
          <p>Your worlds, characters and unfinished chapters.</p>
        </div>
        <button className="story-library-header__new" onClick={() => setPickerOpen(true)}><Plus size={17}/> New story</button>
      </header>

      {!loading && conversations.length > 0 && (
        <div className="story-library-tools">
          <label className="story-library-search">
            <Search size={17}/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stories, characters, moments..." />
          </label>
          <div className="story-library-toggle" aria-label="Story library view">
            <button className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Stories</button>
            <button className={view === "archived" ? "active" : ""} onClick={() => setView("archived")}><Archive size={13}/> Archived</button>
          </div>
        </div>
      )}

      {loading && <PageState icon={<LoaderCircle className="spin" size={28}/>} text="Opening your library..." />}
      {!loading && error && <div className="chats-page__notice"><Sparkles size={17}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16}/></button></div>}

      {!loading && conversations.length === 0 && (
        <div className="page-state page-state--empty chats-empty">
          <span><MessageCircle size={28}/></span><small>YOUR FIRST STORY</small><h2>Nothing here yet</h2><p>Choose a character and open the first page.</p>
          <button onClick={() => setPickerOpen(true)}><Plus size={17}/> Start a story</button>
        </div>
      )}

      {!loading && conversations.length > 0 && filtered.length === 0 && <PageState icon={<Search size={27}/>} text="No stories match that search." />}

      {!loading && filtered.length > 0 && (
        <div className="story-shelf">
          {pinnedStories.length > 0 && (
            <section className="story-shelf-section">
              <div className="story-shelf-section__heading"><div><span>PINNED</span><h2>Keep close</h2></div><small>{pinnedStories.length}</small></div>
              <div className="story-shelf-grid">{pinnedStories.map(renderStoryCard)}</div>
            </section>
          )}

          {recentStories.length > 0 && (
            <section className="story-shelf-section">
              <div className="story-shelf-section__heading"><div><span>{view === "archived" ? "ARCHIVE" : "RECENT"}</span><h2>{view === "archived" ? "Archived stories" : "Continue reading"}</h2></div><small>{recentStories.length}</small></div>
              <div className="story-shelf-grid">{recentStories.map(renderStoryCard)}</div>
            </section>
          )}
        </div>
      )}

      {pickerOpen && (
        <div className="conversation-picker-backdrop" onMouseDown={() => !creatingId && setPickerOpen(false)}>
          <section className="conversation-picker conversation-picker--editorial" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="conversation-picker-title">
            <header>
              <div><p>NEW STORY</p><h2 id="conversation-picker-title">Who is this story with?</h2><span>Choose a character. Velvet will create a fresh timeline.</span></div>
              <button onClick={() => setPickerOpen(false)} disabled={Boolean(creatingId)} aria-label="Close"><X size={20}/></button>
            </header>
            {characters.length > 0 ? (
              <div className="conversation-picker__list conversation-picker__list--editorial">
                {characters.map((character) => (
                  <button key={character.id} onClick={() => handleCreate(character)} disabled={Boolean(creatingId)} style={{ "--character-color": character.color }}>
                    <span className="conversation-row__avatar">{character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.initials}</span>
                    <span><strong>{character.name}</strong><small>{character.role}</small></span>
                    {creatingId === character.id ? <LoaderCircle className="spin" size={20}/> : <Plus size={20}/>} 
                  </button>
                ))}
              </div>
            ) : (
              <div className="conversation-picker__empty"><p>Create a character before beginning a story.</p><button onClick={() => { setPickerOpen(false); onBrowseCharacters(); }}>Create a character</button></div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function PageState({ icon, text }) { return <div className="page-state">{icon}<p>{text}</p></div>; }
function sortConversations(a, b) {
  if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}
function cleanPreview(value = "") {
  return value
    .replaceAll("*", "").replaceAll("/", "").replaceAll("[", "").replaceAll("]", "")
    .replaceAll("~", "").replaceAll(">", "").replaceAll("#", "")
    .replace(/\s+/g, " ").trim();
}
function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { day: "2-digit", month: "short", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function downloadStory(conversation, messages, format) {
  const characterName = conversation.character?.name || "Character";
  const title = conversation.title || characterName;
  const safeName = title.replace(/[^a-z0-9áéíóúñ_-]+/gi, "-").replace(/^-|-$/g, "") || "velvet-story";
  let content;
  let type;
  let extension;
  if (format === "json") {
    content = JSON.stringify({ title, character: characterName, exportedAt: new Date().toISOString(), messages }, null, 2);
    type = "application/json"; extension = "json";
  } else {
    const lines = messages.map((message) => `${message.sender === "user" ? "You" : characterName}:\n${message.content}`);
    content = format === "markdown" ? `# ${title}\n\n**Character:** ${characterName}\n\n---\n\n${lines.join("\n\n---\n\n")}` : `${title}\nCharacter: ${characterName}\n\n${lines.join("\n\n")}`;
    type = "text/plain"; extension = format === "markdown" ? "md" : "txt";
  }
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a"); link.href = url; link.download = `${safeName}.${extension}`; link.click(); URL.revokeObjectURL(url);
}

export default Chats;

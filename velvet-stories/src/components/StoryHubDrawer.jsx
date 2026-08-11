import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookOpen,
  ChevronRight,
  GitBranch,
  HeartHandshake,
  ListTodo,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useChats } from "../context/ChatsContext";

const TABS = [
  ["search", "Search", Search],
  ["bookmarks", "Bookmarks", Bookmark],
  ["chapters", "Chapters", BookOpen],
  ["cast", "Cast", Users],
  ["relationship", "Bond", HeartHandshake],
  ["threads", "Threads", ListTodo],
  ["branches", "Branches", GitBranch],
];

export default function StoryHubDrawer({ open, onClose, character, onJumpToMessage, onOpenConversation }) {
  const { getStoryHubData, searchConversationMessages, getConversation } = useChats();
  const conversation = getConversation(character.id);
  const [tab, setTab] = useState("search");
  const [hub, setHub] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !conversation?.conversationId) return;
    let live = true;
    setLoading(true);
    getStoryHubData(character.id)
      .then((data) => live && setHub(data))
      .catch((error) => console.error("Story Hub load failed:", error))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [open, character.id, conversation?.conversationId]);

  useEffect(() => {
    if (!open || tab !== "search") return;
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchConversationMessages(character.id, clean)
        .then(setResults)
        .catch((error) => console.error("Story search failed:", error));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, tab, query, character.id]);

  const castEntries = useMemo(() => Object.entries(hub?.cast || {}), [hub?.cast]);

  if (!open) return null;

  return (
    <div className="story-hub-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="story-hub" role="dialog" aria-modal="true" aria-label="Story Hub">
        <header className="story-hub__header">
          <div>
            <span><Sparkles size={15} /> STORY ENGINE V4</span>
            <strong>Story Hub</strong>
          </div>
          <button onClick={onClose} aria-label="Close Story Hub"><X size={20} /></button>
        </header>

        <nav className="story-hub__tabs" aria-label="Story Hub sections">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <Icon size={16} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="story-hub__body">
          {loading && !hub && <p className="story-hub__empty">Reading the story…</p>}

          {tab === "search" && (
            <section className="story-hub__section">
              <label className="story-hub__search">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this story…" autoFocus />
              </label>
              {query.trim().length < 2 && <p className="story-hub__empty">Type at least two letters. Search covers the full conversation, not only loaded messages.</p>}
              {results.map((message) => (
                <button key={message.id} className="story-hub__result" onClick={() => onJumpToMessage?.(message.id)}>
                  <small>{message.sender === "user" ? "YOU" : character.name.toUpperCase()} · {formatDate(message.createdAt)}</small>
                  <span>{message.content}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {query.trim().length >= 2 && results.length === 0 && <p className="story-hub__empty">No matching scene found.</p>}
            </section>
          )}

          {tab === "bookmarks" && (
            <section className="story-hub__section">
              {(hub?.bookmarks || []).map((message) => (
                <button key={message.id} className="story-hub__result" onClick={() => onJumpToMessage?.(message.id)}>
                  <Bookmark size={16} fill="currentColor" />
                  <span>{message.bookmarkLabel || message.content}</span>
                  <small>{formatDate(message.createdAt)}</small>
                </button>
              ))}
              {!hub?.bookmarks?.length && <p className="story-hub__empty">No favorite scenes yet. Bookmark any message from its ⋯ menu.</p>}
            </section>
          )}

          {tab === "chapters" && (
            <section className="story-hub__section story-hub__chapters">
              {hub?.activeChapter?.title && (
                <article className="story-hub__chapter story-hub__chapter--active">
                  <small>NOW · CHAPTER {hub.activeChapter.number || "?"}</small>
                  <strong>{hub.activeChapter.title}</strong>
                  {hub.activeChapter.summary && <p>{hub.activeChapter.summary}</p>}
                </article>
              )}
              {[...(hub?.chapters || [])].reverse().map((chapter) => (
                <article key={`${chapter.number}-${chapter.title}`} className="story-hub__chapter">
                  <small>CHAPTER {chapter.number}</small>
                  <strong>{chapter.title}</strong>
                  {chapter.summary && <p>{chapter.summary}</p>}
                </article>
              ))}
              {!hub?.activeChapter?.title && !hub?.chapters?.length && <p className="story-hub__empty">Chapters will appear automatically as the story develops.</p>}
            </section>
          )}

          {tab === "cast" && (
            <section className="story-hub__section story-hub__cast">
              {castEntries.map(([name, item]) => (
                <article key={name}>
                  <div className="story-hub__cast-avatar">{name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{name}</strong>
                    <small>{item.role || "Side character"}</small>
                    {item.personality && <p>{item.personality}</p>}
                    {item.current_status && <span>{item.current_status}</span>}
                  </div>
                </article>
              ))}
              {!castEntries.length && <p className="story-hub__empty">Recurring NPCs will build their own compact continuity here automatically.</p>}
            </section>
          )}

          {tab === "relationship" && (
            <RelationshipPanel relationship={hub?.relationship || {}} characterName={character.name} />
          )}


          {tab === "threads" && (
            <section className="story-hub__section story-hub__threads">
              {(hub?.unfinishedThreads || []).filter((thread) => thread?.status !== "resolved").map((thread, index) => (
                <article key={thread.id || `${thread.title}-${index}`} className="story-hub__thread">
                  <ListTodo size={17} />
                  <div>
                    <strong>{thread.title || thread.label || "Unfinished thread"}</strong>
                    {(thread.detail || thread.context) && <p>{thread.detail || thread.context}</p>}
                    {thread.last_seen && <small>Last touched: {thread.last_seen}</small>}
                  </div>
                </article>
              ))}
              {!(hub?.unfinishedThreads || []).some((thread) => thread?.status !== "resolved") && <p className="story-hub__empty">No open threads right now. Promises, plans, suspicions, invitations and unresolved conflicts will appear here automatically.</p>}
            </section>
          )}

          {tab === "branches" && (
            <section className="story-hub__section story-hub__branches">
              {(hub?.branches || []).map((branch) => (
                <button key={branch.id} className={`story-hub__branch${branch.id === conversation?.conversationId ? " active" : ""}`} onClick={() => branch.id !== conversation?.conversationId && onOpenConversation?.(branch.id)}>
                  <GitBranch size={17} />
                  <span><strong>{branch.title || "Untitled branch"}</strong><small>{branch.id === conversation?.conversationId ? "Current timeline" : branch.branch_parent_id ? "Branch" : "Original timeline"}</small></span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!hub?.branches?.length && <p className="story-hub__empty">Create a branch from any message to explore another timeline without destroying the original.</p>}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function RelationshipPanel({ relationship, characterName }) {
  const metrics = [
    ["Trust", relationship.trust],
    ["Affection", relationship.affection],
    ["Attraction", relationship.attraction],
    ["Tension", relationship.tension],
    ["Familiarity", relationship.familiarity],
    ["Resentment", relationship.resentment],
  ];
  const hasData = metrics.some(([, value]) => Number.isFinite(Number(value)));
  return (
    <section className="story-hub__section story-hub__relationship">
      <div className="story-hub__relationship-title">
        <HeartHandshake size={22} />
        <div><small>RELATIONSHIP WITH {characterName.toUpperCase()}</small><strong>{relationship.current_dynamic || "Still being established"}</strong></div>
      </div>
      {hasData ? metrics.map(([label, value]) => (
        <div className="story-hub__meter" key={label}>
          <span>{label}</span><div><i style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></div><b>{Math.round(Number(value) || 0)}</b>
        </div>
      )) : <p className="story-hub__empty">Velvet will let the relationship emerge from actual events instead of forcing a trope.</p>}
      {relationship.last_shift && <p className="story-hub__shift"><strong>Latest shift</strong>{relationship.last_shift}</p>}
    </section>
  );
}

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString([], { day: "2-digit", month: "short" }); }
  catch { return ""; }
}

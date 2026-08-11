import { ArrowLeft, Building2, Check, Clock3, LoaderCircle, MapPin, Pencil, Plus, Search, ScrollText, Sparkles, ToggleLeft, ToggleRight, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLorebooks } from "../context/LorebooksContext";
import { useFeedback } from "../context/FeedbackContext";
import "../styles/lorebooks.css";

const bookInitial = { name: "", description: "", genre: "", color: "#7a2942" };
const entryInitial = { entryType: "character", name: "", content: "", keywords: "", eventDate: "", isActive: true, alwaysInclude: false };
const colors = ["#7a2942", "#243b6b", "#36594d", "#6d3e78", "#81552f", "#34343f"];
const types = [
  { id: "character", label: "Characters", icon: UsersRound }, { id: "location", label: "Locations", icon: MapPin },
  { id: "group", label: "Groups", icon: Building2 }, { id: "family", label: "Families", icon: UsersRound },
  { id: "organization", label: "Organizations", icon: Building2 }, { id: "relationship", label: "Relationships", icon: UsersRound },
  { id: "rule", label: "World rules", icon: ScrollText }, { id: "secret", label: "Secrets", icon: ScrollText },
  { id: "event", label: "Timeline", icon: Clock3 },
];

function Lorebooks({ onBack }) {
  const { lorebooks, lorebooksLoading, saveLorebook, deleteLorebook, loadEntries, saveEntry, deleteEntry, toggleEntry } = useLorebooks();
  const { confirmAction, scheduleDeletion } = useFeedback();
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [bookEditor, setBookEditor] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm, setBookForm] = useState(bookInitial);
  const [entryEditor, setEntryEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState(entryInitial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [worldSearch, setWorldSearch] = useState("");

  useEffect(() => { if (selected) refreshEntries(selected.id); }, [selected?.id]);

  async function refreshEntries(id) {
    try { setEntriesLoading(true); setEntries(await loadEntries(id)); }
    catch (requestError) { setError(requestError.message); }
    finally { setEntriesLoading(false); }
  }

  function openBook(book = null) { setEditingBook(book); setBookForm(book ? { name: book.name, description: book.description, genre: book.genre, color: book.color } : bookInitial); setError(""); setBookEditor(true); }
  function openEntry(entry = null, type = "character") { setEditingEntry(entry); setEntryForm(entry ? { ...entry } : { ...entryInitial, entryType: type }); setError(""); setEntryEditor(true); }

  async function submitBook(event) {
    event.preventDefault();
    try { setSaving(true); const saved = await saveLorebook(bookForm, editingBook?.id); setBookEditor(false); if (editingBook && selected?.id === saved.id) setSelected({ ...selected, ...saved }); }
    catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function removeBook(book) {
    if (!await confirmAction({ title: `Delete ${book.name}?`, message: "Every character, location, rule and timeline entry inside this world will be deleted.", confirmLabel: "Delete world" })) return;
    scheduleDeletion({ message: `Deleting ${book.name}`, onCommit: async () => { await deleteLorebook(book.id); if (selected?.id === book.id) setSelected(null); }, onError: (requestError) => setError(requestError.message) });
  }

  async function submitEntry(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const saved = await saveEntry(selected.id, entryForm, editingEntry?.id);
      setEntries((current) => editingEntry ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEntryEditor(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function flipEntry(entry) {
    try { const saved = await toggleEntry(entry.id, !entry.isActive); setEntries((current) => current.map((item) => item.id === saved.id ? saved : item)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function removeEntry(entry) {
    if (!await confirmAction({ title: `Delete ${entry.name}?`, message: "This lore entry will stop influencing every linked conversation.", confirmLabel: "Delete lore" })) return;
    scheduleDeletion({ message: `Deleting ${entry.name}`, onCommit: async () => { await deleteEntry(selected.id, entry.id); setEntries((current) => current.filter((item) => item.id !== entry.id)); }, onError: (requestError) => setError(requestError.message) });
  }

  const filtered = useMemo(() => filter === "all" ? entries : entries.filter((entry) => entry.entryType === filter), [entries, filter]);
  const filteredBooks = useMemo(() => {
    const query = worldSearch.trim().toLowerCase();
    return query ? lorebooks.filter((book) => `${book.name} ${book.genre} ${book.description}`.toLowerCase().includes(query)) : lorebooks;
  }, [lorebooks, worldSearch]);

  if (selected) return <section className="lore-page">
    <header className="lore-detail__hero" style={{ "--lore-color": selected.color }}>
      <button onClick={() => setSelected(null)}><ArrowLeft size={17} />All worlds</button>
      <div><p>{selected.genre || "YOUR PRIVATE UNIVERSE"}</p><h1>{selected.name}</h1><span>{selected.description || "A world waiting to be defined."}</span></div>
      <button className="lore-detail__add" onClick={() => openEntry()}><Plus size={17} />Add lore</button>
    </header>
    {error && <Notice text={error} close={() => setError("")} />}
    <nav className="lore-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All · {entries.length}</button>{types.map((type) => { const TypeIcon = type.icon; return <button key={type.id} className={filter === type.id ? "active" : ""} onClick={() => setFilter(type.id)}><TypeIcon size={15} />{type.label} · {entries.filter((entry) => entry.entryType === type.id).length}</button>; })}</nav>
    {entriesLoading && <div className="page-state"><LoaderCircle className="spin" size={27} /><p>Opening this world...</p></div>}
    {!entriesLoading && entries.length === 0 && <div className="page-state page-state--empty"><span><ScrollText size={27} /></span><h2>This world has no lore yet</h2><p>Add characters, places, families, organizations, relationships, secrets, rules or timeline events.</p><button onClick={() => openEntry()}>Add lore</button></div>}
    {!entriesLoading && filtered.length > 0 && <div className="lore-entry-grid">{filtered.map((entry) => <LoreEntry key={entry.id} entry={entry} onToggle={() => flipEntry(entry)} onEdit={() => openEntry(entry)} onDelete={() => removeEntry(entry)} />)}</div>}
    {!entriesLoading && entries.length > 0 && filtered.length === 0 && <div className="page-state"><p>No entries in this category yet.</p><button onClick={() => openEntry(null, filter)}>Add one</button></div>}
    {entryEditor && <EntryEditor form={entryForm} setForm={setEntryForm} editing={editingEntry} saving={saving} error={error} close={() => setEntryEditor(false)} submit={submitEntry} />}
  </section>;

  return <section className="lore-page">
    <header className="page-heading lore-page__heading"><div><button className="lore-page__back" onClick={onBack}><ArrowLeft size={17} />Profile</button><p>WORLD & LOREBOOKS</p><h1>Your universes</h1><span>Build consistent worlds that exist beyond a single conversation.</span></div><button className="lore-page__new" onClick={() => openBook()}><Plus size={18} />Create world</button></header>
    {error && <Notice text={error} close={() => setError("")} />}
    {!lorebooksLoading && lorebooks.length > 0 && <label className="lorebook-search"><Search size={18}/><input value={worldSearch} onChange={(event) => setWorldSearch(event.target.value)} placeholder="Search worlds, genres or descriptions..."/>{worldSearch && <button onClick={() => setWorldSearch("")}><X size={15}/></button>}</label>}
    {lorebooksLoading && <div className="page-state"><LoaderCircle className="spin" size={27} /><p>Opening your universes...</p></div>}
    {!lorebooksLoading && lorebooks.length === 0 && <div className="page-state page-state--empty"><span><Sparkles size={27} /></span><h2>Create your first universe</h2><p>A lorebook keeps characters, locations and history consistent.</p><button onClick={() => openBook()}>Create world</button></div>}
    {!lorebooksLoading && filteredBooks.length > 0 && <div className="lorebook-grid">{filteredBooks.map((book) => <article key={book.id} className="lorebook-card" style={{ "--lore-color": book.color }}><button className="lorebook-card__main" onClick={() => setSelected(book)}><span className="lorebook-card__icon"><Sparkles size={20} /></span><div className="lorebook-card__copy"><small>PRIVATE UNIVERSE</small><h2>{book.name}</h2><p>{book.description || "A world waiting to be written."}</p>{book.genre && <div className="lorebook-card__genre">{book.genre}</div>}<em>{book.entryCount} lore {book.entryCount === 1 ? "entry" : "entries"}</em></div></button><footer><button onClick={() => openBook(book)}><Pencil size={15} />Edit</button><button className="danger" onClick={() => removeBook(book)}><Trash2 size={15} />Delete</button></footer></article>)}</div>}
    {!lorebooksLoading && lorebooks.length > 0 && filteredBooks.length === 0 && <div className="page-state"><Search size={26}/><p>No worlds match your search.</p></div>}
    {bookEditor && <BookEditor form={bookForm} setForm={setBookForm} editing={editingBook} saving={saving} error={error} close={() => setBookEditor(false)} submit={submitBook} />}
  </section>;
}

function LoreEntry({ entry, onToggle, onEdit, onDelete }) { const type = types.find((item) => item.id === entry.entryType) || types[3]; const Icon = type.icon; return <article className={`lore-entry${entry.isActive ? "" : " lore-entry--inactive"}`}><header><span><Icon size={17} />{type.label.slice(0, -1)}</span>{entry.alwaysInclude && <em>Always included</em>}</header><h2>{entry.name}</h2>{entry.eventDate && <small>{entry.eventDate}</small>}<p>{entry.content}</p>{entry.keywords && <div>{entry.keywords.split(",").map((word) => <i key={word}>{word.trim()}</i>)}</div>}<footer><button onClick={onToggle}>{entry.isActive ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}{entry.isActive ? "Active" : "Inactive"}</button><button onClick={onEdit}><Pencil size={15} /></button><button className="danger" onClick={onDelete}><Trash2 size={15} /></button></footer></article>; }

function BookEditor({ form, setForm, editing, saving, error, close, submit }) { return <Modal title={editing ? "Refine this universe" : "Create a universe"} close={close} saving={saving}><form className="lore-editor" onSubmit={submit}><label>World name <strong>*</strong><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Westbridge University" autoFocus /></label><label>Genre or atmosphere<input value={form.genre} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))} placeholder="Elite university romance" /></label><label>Description<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="4" placeholder="The central premise and feeling of this world..." /></label><fieldset><legend>World color</legend>{colors.map((color) => <button key={color} type="button" className={form.color === color ? "selected" : ""} style={{ "--swatch": color }} onClick={() => setForm((current) => ({ ...current, color }))}><Check size={13} /></button>)}</fieldset>{error && <p className="lore-editor__error">{error}</p>}<EditorFooter close={close} saving={saving} disabled={!form.name.trim()} /></form></Modal>; }

function EntryEditor({ form, setForm, editing, saving, error, close, submit }) { return <Modal title={editing ? "Refine this lore" : "Add to this world"} close={close} saving={saving}><form className="lore-editor" onSubmit={submit}><label>Entry type<select value={form.entryType} onChange={(event) => setForm((current) => ({ ...current, entryType: event.target.value }))}>{types.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label><label>Name <strong>*</strong><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nathan Cole, The rooftop, Founders' Ball..." autoFocus /></label>{form.entryType === "event" && <label>Date or position in timeline<input value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} placeholder="October 14 · After the championship" /></label>}<label>Canonical information <strong>*</strong><textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} rows="7" maxLength="4000" placeholder="Everything the AI must know and keep consistent..." /></label><label>Activation keywords<input value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="Nathan, best friend, racing team" /><small>Separated by commas. The entry activates when recent messages contain one.</small></label><label className="lore-editor__check"><input type="checkbox" checked={form.alwaysInclude} onChange={(event) => setForm((current) => ({ ...current, alwaysInclude: event.target.checked }))} /><span><strong>Always include</strong><small>Send this entry to the AI in every response within this world.</small></span></label><label className="lore-editor__check"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /><span><strong>Entry active</strong><small>Inactive lore stays saved but is hidden from the AI.</small></span></label>{error && <p className="lore-editor__error">{error}</p>}<EditorFooter close={close} saving={saving} disabled={!form.name.trim() || !form.content.trim()} /></form></Modal>; }

function Modal({ title, close, saving, children }) { return <div className="lore-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && close()}><section className="lore-modal"><header><div><p>LORE ATELIER</p><h2>{title}</h2></div><button onClick={close} disabled={saving}><X size={20} /></button></header>{children}</section></div>; }
function EditorFooter({ close, saving, disabled }) { return <footer><button type="button" onClick={close} disabled={saving}>Cancel</button><button type="submit" disabled={saving || disabled}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "Saving..." : "Save"}</button></footer>; }
function Notice({ text, close }) { return <div className="lore-notice"><Sparkles size={16} /><span>{text}</span><button onClick={close}><X size={15} /></button></div>; }
export default Lorebooks;

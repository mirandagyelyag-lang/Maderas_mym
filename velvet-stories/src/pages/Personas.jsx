import { ArrowLeft, Check, Crown, LoaderCircle, Pencil, Plus, Sparkles, Trash2, Upload, UserRound, X } from "lucide-react";
import { useState } from "react";
import { usePersonas } from "../context/PersonasContext";
import { useFeedback } from "../context/FeedbackContext";
import "../styles/personas.css";

const initialForm = { name: "", pronouns: "", age: "", role: "", appearance: "", personality: "", background: "", goals: "", preferences: "", boundaries: "", speechStyle: "", notes: "", imageUrl: "", imageFile: null, color: "#7a2942", isDefault: false };
const colors = ["#7a2942", "#243b6b", "#36594d", "#6d3e78", "#81552f", "#34343f"];

function Personas({ onBack }) {
  const { personas, personasLoading, savePersona, deletePersona } = usePersonas();
  const { confirmAction, scheduleDeletion } = useFeedback();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openEditor(persona = null) {
    setEditing(persona); setError("");
    setForm(persona ? { ...initialForm, ...persona } : { ...initialForm, isDefault: personas.length === 0 });
    setPreview(persona?.imageUrl || ""); setEditorOpen(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value })); setError("");
  }

  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setError("Choose an image smaller than 5 MB.");
    setForm((current) => ({ ...current, imageFile: file })); setPreview(URL.createObjectURL(file));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true); setError("");
      await savePersona(form, editing?.id || null);
      setEditorOpen(false);
    } catch (requestError) { setError(requestError.message || "We couldn't save this identity."); }
    finally { setSaving(false); }
  }

  async function remove(persona) {
    if (!await confirmAction({ title: `Delete ${persona.name}?`, message: "Conversations using this identity will return to your account identity.", confirmLabel: "Delete persona" })) return;
    scheduleDeletion({ message: `Deleting ${persona.name}`, onCommit: () => deletePersona(persona.id), onError: (requestError) => window.alert(requestError.message) });
  }

  return <section className="personas-page">
    <header className="page-heading personas-page__heading">
      <div><button className="personas-page__back" onClick={onBack}><ArrowLeft size={17} />Profile</button><p>ROLEPLAY IDENTITIES</p><h1>Your personas</h1><span>Be someone different in every world—or reuse the identity you love.</span></div>
      <button className="personas-page__new" onClick={() => openEditor()}><Plus size={18} />Create persona</button>
    </header>

    {personasLoading && <div className="page-state"><LoaderCircle className="spin" size={28} /><p>Opening your wardrobe...</p></div>}
    {!personasLoading && personas.length === 0 && <div className="page-state page-state--empty"><span><UserRound size={28} /></span><h2>Who are you in this story?</h2><p>Create your first reusable roleplay identity.</p><button onClick={() => openEditor()}>Create persona</button></div>}
    {!personasLoading && personas.length > 0 && <div className="persona-grid">{personas.map((persona) => <article key={persona.id} className="persona-card" style={{ "--persona-color": persona.color }}>
      <div className="persona-card__visual">{persona.imageUrl ? <img src={persona.imageUrl} alt="" /> : <span>{initials(persona.name)}</span>}{persona.isDefault && <em><Crown size={13} />Default</em>}</div>
      <div className="persona-card__content"><span>{persona.role || "Roleplay identity"}</span><h2>{persona.name}</h2><small>{[persona.pronouns, persona.age].filter(Boolean).join(" · ") || "No personal details yet"}</small><p>{persona.appearance || persona.personality || "Ready to enter a new world."}</p></div>
      <footer><button onClick={() => openEditor(persona)}><Pencil size={16} />Edit</button><button className="danger" onClick={() => remove(persona)}><Trash2 size={16} />Delete</button></footer>
    </article>)}</div>}

    {editorOpen && <div className="persona-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditorOpen(false)}>
      <form className="persona-editor" onSubmit={submit}>
        <header><div><p>IDENTITY ATELIER</p><h2>{editing ? "Refine your persona" : "Create a new self"}</h2></div><button type="button" onClick={() => setEditorOpen(false)} disabled={saving}><X size={20} /></button></header>
        <div className="persona-editor__visual" style={{ "--persona-color": form.color }}><div>{preview ? <img src={preview} alt="Preview" /> : <span>{initials(form.name) || <UserRound size={28} />}</span>}</div><label><Upload size={16} />{preview ? "Replace photo" : "Choose photo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectImage} /></label></div>
        <div className="persona-editor__grid">
          <label>Name used in the story <strong>*</strong><input name="name" value={form.name} onChange={updateField} placeholder="Antonia" autoFocus /></label>
          <label>Pronouns<input name="pronouns" value={form.pronouns} onChange={updateField} placeholder="she/her" /></label>
          <label>Age<input name="age" value={form.age} onChange={updateField} placeholder="21" /></label>
          <label>Role in the world<input name="role" value={form.role} onChange={updateField} placeholder="Computer science student" /></label>
          <label className="wide">Physical appearance<textarea name="appearance" value={form.appearance} onChange={updateField} rows="3" placeholder="Hair, eyes, height, style, distinctive details..." /></label>
          <label className="wide">Personality<textarea name="personality" value={form.personality} onChange={updateField} rows="3" placeholder="Strengths, flaws, habits and social style..." /></label>
          <label className="wide">Background<textarea name="background" value={form.background} onChange={updateField} rows="3" placeholder="Family, studies, work, history and current situation..." /></label>
          <label className="wide">Goals & motivations<textarea name="goals" value={form.goals} onChange={updateField} rows="3" placeholder="What this persona wants from life or this world..." /></label>
          <label className="wide">Preferences<textarea name="preferences" value={form.preferences} onChange={updateField} rows="3" placeholder="Likes, dislikes, routines, tastes and social preferences..." /></label>
          <label className="wide">Boundaries<textarea name="boundaries" value={form.boundaries} onChange={updateField} rows="3" placeholder="Things other characters should respect about you." /></label>
          <label className="wide">Speech style<textarea name="speechStyle" value={form.speechStyle} onChange={updateField} rows="3" placeholder="How you usually talk, text or express yourself..." /></label>
          <label className="wide">Instructions about you<textarea name="notes" value={form.notes} onChange={updateField} rows="3" placeholder="Details the AI must respect. It still may never control your actions or dialogue." /></label>
        </div>
        <fieldset className="persona-editor__colors"><legend>Identity color</legend>{colors.map((color) => <button type="button" key={color} className={form.color === color ? "selected" : ""} style={{ "--swatch": color }} onClick={() => setForm((current) => ({ ...current, color }))}><Check size={13} /></button>)}</fieldset>
        <label className="persona-editor__default"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} /><span><Crown size={17} /><strong>Use as my default identity</strong><small>New conversations can begin with this persona.</small></span></label>
        {error && <p className="persona-editor__error"><Sparkles size={15} />{error}</p>}
        <footer><button type="button" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving || !form.name.trim()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{saving ? "Saving..." : "Save persona"}</button></footer>
      </form>
    </div>}
  </section>;
}

function initials(name = "") { return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join(""); }
export default Personas;

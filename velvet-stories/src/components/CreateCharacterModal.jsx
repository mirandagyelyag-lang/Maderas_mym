import {
  BookOpen,
  Brain,
  Check,
  Heart,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Palette,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCharacters } from "../context/CharactersContext";
import "../styles/create-character-modal.css";

const initialForm = {
  name: "",
  role: "",
  description: "",
  personality: "",
  relationship: "",
  world: "",
  values: "",
  fears: "",
  habits: "",
  contradictions: "",
  speechStyle: "",
  boundaries: "",
  scenario: "",
  exampleDialogue: "",
  responseLength: "balanced",
  narrationStyle: "balanced",
  firstMessage: "",
  imageUrl: "",
  coverUrl: "",
  imageFile: null,
  coverFile: null,
  color: "#7a2942",
};

const palette = ["#7a2942", "#243b6b", "#36594d", "#6d3e78", "#81552f", "#34343f", "#8a334f", "#405b78"];

function CreateCharacterModal({ onClose, onCreated, character = null }) {
  const { createCharacter, updateCharacter, enhanceCharacterDraft } = useCharacters();
  const [form, setForm] = useState(() => character ? {
    ...initialForm,
    name: character.name || "",
    role: character.role || "",
    description: character.description || "",
    personality: character.personality || "",
    relationship: character.relationship || "",
    world: character.world || "",
    values: character.values || "",
    fears: character.fears || "",
    habits: character.habits || "",
    contradictions: character.contradictions || "",
    speechStyle: character.speechStyle || "",
    boundaries: character.boundaries || "",
    scenario: character.scenario || "",
    exampleDialogue: character.exampleDialogue || "",
    responseLength: character.responseLength || "balanced",
    narrationStyle: character.narrationStyle || "balanced",
    firstMessage: character.firstMessage || "",
    imageUrl: character.imageUrl || "",
    coverUrl: character.coverUrl || "",
    color: character.color || "#7a2942",
  } : initialForm);
  const [avatarPreview, setAvatarPreview] = useState(character?.imageUrl || "");
  const [coverPreview, setCoverPreview] = useState(character?.coverUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const completion = useMemo(() => {
    const required = [form.name, form.role, form.personality, form.firstMessage];
    const filled = required.filter((value) => value?.trim()).length;
    return Math.round((filled / required.length) * 100);
  }, [form.name, form.role, form.personality, form.firstMessage]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function selectImage(event, kind) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Images must be smaller than 5 MB.");
    const preview = URL.createObjectURL(file);
    if (kind === "avatar") {
      setAvatarPreview(preview);
      setForm((current) => ({ ...current, imageFile: file }));
    } else {
      setCoverPreview(preview);
      setForm((current) => ({ ...current, coverFile: file }));
    }
    setError("");
  }

  function removeImage(kind) {
    if (kind === "avatar") {
      setAvatarPreview("");
      setForm((current) => ({ ...current, imageFile: null, imageUrl: "" }));
    } else {
      setCoverPreview("");
      setForm((current) => ({ ...current, coverFile: null, coverUrl: "" }));
    }
  }

  async function handleEnhanceCharacter() {
    if (enhancing || saving) return;
    if (!form.name.trim() || !form.role.trim()) {
      setError("Add a name and role before using AI Polish.");
      return;
    }

    try {
      setEnhancing(true);
      setError("");
      const suggestions = await enhanceCharacterDraft(form);
      setForm((current) => ({
        ...current,
        personality: suggestions.personality || current.personality,
        values: suggestions.values || current.values,
        fears: suggestions.fears || current.fears,
        habits: suggestions.habits || current.habits,
        contradictions: suggestions.contradictions || current.contradictions,
        speechStyle: suggestions.speechStyle || current.speechStyle,
        boundaries: suggestions.boundaries || current.boundaries,
        scenario: suggestions.scenario || current.scenario,
        exampleDialogue: suggestions.exampleDialogue || current.exampleDialogue,
      }));
    } catch (requestError) {
      console.error("Character AI Polish failed:", requestError);
      setError(requestError.message || "AI Polish couldn't refine this character.");
    } finally {
      setEnhancing(false);
    }
  }

  function validateCharacter() {
    if (!form.name.trim()) return setError("Give your character a name."), false;
    if (!form.role.trim()) return setError("Add a role or archetype."), false;
    if (!form.personality.trim()) return setError("Describe your character's personality."), false;
    if (!form.firstMessage.trim()) return setError("Write an opening scene or first message."), false;
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateCharacter() || saving) return;

    try {
      setSaving(true);
      setError("");
      const saved = character
        ? await updateCharacter(character.id, form)
        : await createCharacter(form);
      onCreated(saved);
    } catch (requestError) {
      console.error("Error saving character:", requestError);
      setError(translateCharacterError(requestError.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop character-studio-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="character-studio" role="dialog" aria-modal="true" aria-labelledby="character-studio-title">
        <header className="character-studio__topbar">
          <div>
            <p className="character-studio__eyebrow">PRIVATE CHARACTER STUDIO</p>
            <h2 id="character-studio-title">{character ? `Shape ${form.name || "your character"}` : "Create a new character"}</h2>
          </div>
          <div className="character-studio__top-actions">
            <button type="button" className="character-studio__ai" onClick={handleEnhanceCharacter} disabled={saving || enhancing}>
              {enhancing ? <LoaderCircle className="character-modal__spinner" size={16} /> : <Sparkles size={16} />}
              <span>{enhancing ? "Polishing…" : "AI Polish"}</span>
            </button>
            <button type="button" className="character-studio__close" onClick={onClose} disabled={saving} aria-label="Close character studio">
              <X size={20} />
            </button>
          </div>
        </header>

        <form className="character-studio__layout" onSubmit={handleSubmit}>
          <aside className="character-studio__preview" style={{ "--preview-color": form.color }}>
            <div className="character-preview-card">
              <div className="character-preview-card__cover">
                {coverPreview ? <img src={coverPreview} alt="Character cover preview" /> : <div className="character-preview-card__cover-fallback"><ImagePlus size={28} /><span>Add a cover</span></div>}
                <div className="character-preview-card__shade" />
                <div className="character-preview-card__completion">
                  <span>{completion}% ready</span>
                  <i><b style={{ width: `${completion}%` }} /></i>
                </div>
              </div>

              <div className="character-preview-card__identity">
                <div className="character-preview-card__avatar">
                  {avatarPreview ? <img src={avatarPreview} alt="Character avatar preview" /> : <span>{createInitials(form.name)}</span>}
                </div>
                <div>
                  <small>{form.role || "Role / archetype"}</small>
                  <strong>{form.name || "Your character"}</strong>
                </div>
              </div>

              <p className="character-preview-card__intro">{form.description || "Their introduction will appear here as you write it."}</p>

              <div className="character-preview-card__bond">
                <Heart size={14} />
                <div>
                  <small>RELATIONSHIP TO YOU</small>
                  <span>{form.relationship || "Not defined yet"}</span>
                </div>
              </div>
            </div>

            <div className="character-studio__appearance-mini">
              <MiniImageControl title="Portrait" preview={avatarPreview} onChange={(event) => selectImage(event, "avatar")} onRemove={() => removeImage("avatar")} disabled={saving} />
              <MiniImageControl title="Cover" preview={coverPreview} onChange={(event) => selectImage(event, "cover")} onRemove={() => removeImage("cover")} disabled={saving} />
              <fieldset className="character-studio__palette">
                <legend><Palette size={14} /> Accent</legend>
                <div>{palette.map((color) => (
                  <button key={color} type="button" className={form.color === color ? "selected" : ""} style={{ "--swatch": color }} onClick={() => setForm((current) => ({ ...current, color }))} aria-label={`Choose ${color}`}>
                    <Check size={12} />
                  </button>
                ))}</div>
              </fieldset>
            </div>
          </aside>

          <main className="character-studio__editor">
            <StudioSection icon={<UserRound size={18} />} kicker="ESSENCE" title="Who are they?" description="The few things Velvet should understand before anything else.">
              <div className="studio-grid studio-grid--two">
                <StudioField label="Name" required><input name="name" value={form.name} onChange={updateField} placeholder="Theo Calloway" disabled={saving} /></StudioField>
                <StudioField label="Role / archetype" required><input name="role" value={form.role} onChange={updateField} placeholder="Campus prince, heartbreaker, best friend…" disabled={saving} /></StudioField>
              </div>
              <StudioField label="Introduction" hint="One clean snapshot. Who are they at first glance?">
                <textarea name="description" value={form.description} onChange={updateField} placeholder="Confident without trying, adored by professors and grandmothers alike…" rows="3" disabled={saving} />
              </StudioField>
              <StudioField label="Personality" required hint="Write naturally. Velvet can infer traits from prose better than a list of adjectives.">
                <textarea name="personality" value={form.personality} onChange={updateField} placeholder="He is warm in public, impossible to embarrass, quietly competitive…" rows="6" disabled={saving} />
              </StudioField>
            </StudioSection>

            <StudioSection icon={<Heart size={18} />} kicker="THE BOND" title="Who are they to you?" description="This relationship should shape how they notice, remember and react to you.">
              <StudioField label="Relationship to you" hint="Make this specific. History, current dynamic, what is known and what is not.">
                <textarea name="relationship" value={form.relationship} onChange={updateField} placeholder="Friends since high school. He already likes me, but I read his distance as indifference…" rows="5" disabled={saving} />
              </StudioField>
              <div className="studio-grid studio-grid--two">
                <StudioField label="World"><textarea name="world" value={form.world} onChange={updateField} placeholder="Private university, wealthy social circle, modern city…" rows="3" disabled={saving} /></StudioField>
                <StudioField label="Recurring setup"><textarea name="scenario" value={form.scenario} onChange={updateField} placeholder="Where do your stories with this character naturally happen?" rows="3" disabled={saving} /></StudioField>
              </div>
            </StudioSection>

            <StudioSection icon={<Brain size={18} />} kicker="CHARACTER DNA" title="What makes them human?" description="Useful contradictions and recurring patterns, not a personality spreadsheet.">
              <div className="studio-grid studio-grid--two">
                <StudioField label="Values"><textarea name="values" value={form.values} onChange={updateField} placeholder="Loyalty, independence, family, reputation…" rows="3" disabled={saving} /></StudioField>
                <StudioField label="Fears"><textarea name="fears" value={form.fears} onChange={updateField} placeholder="What can actually get under their skin?" rows="3" disabled={saving} /></StudioField>
                <StudioField label="Habits"><textarea name="habits" value={form.habits} onChange={updateField} placeholder="Small behaviors that recur naturally." rows="3" disabled={saving} /></StudioField>
                <StudioField label="Contradictions"><textarea name="contradictions" value={form.contradictions} onChange={updateField} placeholder="Popular but private. Flirtatious but emotionally avoidant…" rows="3" disabled={saving} /></StudioField>
              </div>
            </StudioSection>

            <StudioSection icon={<MessageCircle size={18} />} kicker="VOICE & BEHAVIOR" title="How do they feel on the page?" description="The difference between knowing a character and actually hearing them.">
              <div className="studio-grid studio-grid--two">
                <StudioField label="Speech style"><textarea name="speechStyle" value={form.speechStyle} onChange={updateField} placeholder="Dry, concise, teasing without performing, rarely over-explains…" rows="4" disabled={saving} /></StudioField>
                <StudioField label="Boundaries"><textarea name="boundaries" value={form.boundaries} onChange={updateField} placeholder="Things they should never do unless the story genuinely earns it." rows="4" disabled={saving} /></StudioField>
              </div>
              <StudioField label="Example dialogue" hint="A few lines are enough. This is a voice sample, not a script.">
                <textarea name="exampleDialogue" value={form.exampleDialogue} onChange={updateField} placeholder={'"You called me. I came. Don\'t make it weird."'} rows="4" disabled={saving} />
              </StudioField>
            </StudioSection>

            <StudioSection icon={<BookOpen size={18} />} kicker="STORY FEEL" title="How should stories with them read?" description="Keep this light. V6 handles most pacing automatically.">
              <div className="studio-choice-row">
                <ChoiceGroup label="Response length" name="responseLength" value={form.responseLength} onChange={updateField} options={[
                  ["short", "Short", "Quick beats"],
                  ["balanced", "Natural", "Default"],
                  ["long", "Detailed", "Only when earned"],
                ]} />
                <ChoiceGroup label="Narration" name="narrationStyle" value={form.narrationStyle} onChange={updateField} options={[
                  ["dialogue", "Dialogue", "Talk-forward"],
                  ["balanced", "Balanced", "Novel-like"],
                  ["immersive", "Immersive", "More atmosphere"],
                ]} />
              </div>
              <StudioField label="Opening scene" required hint="Where the first story begins. It can be dialogue, narration or both.">
                <textarea name="firstMessage" value={form.firstMessage} onChange={updateField} placeholder="The first Monday of the semester was exactly as chaotic as everyone expected…" rows="7" disabled={saving} />
              </StudioField>
            </StudioSection>

            {error && <p className="character-studio__error">{error}</p>}

            <footer className="character-studio__footer">
              <div>
                <strong>{character ? "Changes stay private to your library." : "This character will only exist in your private library."}</strong>
                <span>{completion === 100 ? "Ready to save." : "Name, role, personality and opening scene are required."}</span>
              </div>
              <div>
                <button type="button" className="character-studio__cancel" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="submit" className="character-studio__save" disabled={saving}>
                  {saving ? <><LoaderCircle className="character-modal__spinner" size={17} /> Saving…</> : <><Check size={17} /> {character ? "Save character" : "Create character"}</>}
                </button>
              </div>
            </footer>
          </main>
        </form>
      </section>
    </div>
  );
}

function StudioSection({ icon, kicker, title, description, children }) {
  return (
    <section className="studio-section">
      <header className="studio-section__header">
        <span className="studio-section__icon">{icon}</span>
        <div>
          <p>{kicker}</p>
          <h3>{title}</h3>
          <span>{description}</span>
        </div>
      </header>
      <div className="studio-section__body">{children}</div>
    </section>
  );
}

function StudioField({ label, required = false, hint = "", children }) {
  return (
    <label className="studio-field">
      <span className="studio-field__label">{label}{required && <strong>*</strong>}</span>
      {hint && <small>{hint}</small>}
      {children}
    </label>
  );
}

function ChoiceGroup({ label, name, value, onChange, options }) {
  return (
    <fieldset className="studio-choice-group">
      <legend>{label}</legend>
      <div>
        {options.map(([optionValue, title, subtitle]) => (
          <label key={optionValue} className={value === optionValue ? "selected" : ""}>
            <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={onChange} />
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MiniImageControl({ title, preview, onChange, onRemove, disabled }) {
  return (
    <div className="character-studio__media-control">
      <div><strong>{title}</strong><small>{preview ? "Image selected" : "JPG, PNG or WebP"}</small></div>
      <div>
        <label aria-label={`Choose ${title}`}>
          <Upload size={15} />
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onChange} disabled={disabled} />
        </label>
        {preview && <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${title}`}><Trash2 size={15} /></button>}
      </div>
    </div>
  );
}

function createInitials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "VS";
}

function translateCharacterError(message = "") {
  const error = message.toLowerCase();
  if (error.includes("row-level security") || error.includes("permission")) return "Your account doesn't have permission to save this character or image.";
  if (error.includes("mime") || error.includes("bucket")) return "That image format couldn't be uploaded. Try JPG, PNG or WebP.";
  if (error.includes("maximum") || error.includes("size")) return "The image is too large. Choose one smaller than 5 MB.";
  if (error.includes("network") || error.includes("fetch")) return "We couldn't connect. Check your internet connection.";
  return message || "We couldn't save the character. Try again.";
}

export default CreateCharacterModal;

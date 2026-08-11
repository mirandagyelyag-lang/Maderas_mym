import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Quote,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import "../styles/character-detail.css";

export default function CharacterDetail({
  character,
  onBack,
  onContinue,
  onNewStory,
  onOpenStory,
  onEdit,
}) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("conversations")
        .select("id, title, updated_at, branch_parent_id")
        .eq("character_id", character.id)
        .order("updated_at", { ascending: false })
        .limit(8);

      if (alive) {
        setStories(data || []);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [character.id]);

  const tags = character.tags || [];
  const depth = useMemo(
    () => [
      { label: "Values", value: character.values },
      { label: "Fears", value: character.fears },
      { label: "Habits", value: character.habits },
      { label: "Contradictions", value: character.contradictions },
    ].filter((item) => item.value),
    [character]
  );

  const hasWorldSection = Boolean(character.world || character.scenario);
  const hasVoiceSection = Boolean(character.speechStyle || character.boundaries);

  return (
    <section className="character-profile" style={{ "--character-color": character.color || "var(--accent)" }}>
      <header className="character-profile__topbar">
        <button className="character-profile__back" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Characters</span>
        </button>

        {onEdit && (
          <button className="character-profile__edit" onClick={() => onEdit(character)}>
            <Pencil size={16} />
            <span>Edit character</span>
          </button>
        )}
      </header>

      <section className="character-profile__hero">
        <div className="character-profile__cover" aria-hidden="true">
          {character.coverUrl || character.imageUrl ? (
            <img src={character.coverUrl || character.imageUrl} alt="" />
          ) : (
            <span>{character.initials}</span>
          )}
          <div className="character-profile__cover-shade" />
        </div>

        <div className="character-profile__hero-content">
          <div className="character-profile__avatar">
            {character.imageUrl ? <img src={character.imageUrl} alt="" /> : <span>{character.initials}</span>}
          </div>

          <div className="character-profile__identity">
            <p className="character-profile__eyebrow">{character.role || "Character"}</p>
            <h1>{character.name}</h1>
            <p className="character-profile__intro">
              {character.description || "A story waiting to become something unforgettable."}
            </p>

            {tags.length > 0 && (
              <div className="character-profile__tags">
                {tags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </div>

          <div className="character-profile__hero-actions">
            <button className="character-profile__continue" onClick={() => onContinue(character)}>
              <MessageCircle size={18} />
              <span>Continue story</span>
            </button>
            <button className="character-profile__new" onClick={() => onNewStory(character)}>
              <Plus size={18} />
              <span>New story</span>
            </button>
          </div>
        </div>
      </section>

      <div className="character-profile__layout">
        <main className="character-profile__main">
          {character.relationship && (
            <section className="character-profile__relationship">
              <div className="character-profile__section-heading">
                <span className="character-profile__section-icon"><Heart size={17} /></span>
                <div>
                  <small>RELATIONSHIP TO YOU</small>
                  <h2>Your dynamic</h2>
                </div>
              </div>
              <p>{character.relationship}</p>
            </section>
          )}

          {character.personality && (
            <section className="character-profile__section">
              <div className="character-profile__section-heading">
                <span className="character-profile__section-icon"><Sparkles size={17} /></span>
                <div>
                  <small>CHARACTER CORE</small>
                  <h2>Personality</h2>
                </div>
              </div>
              <p className="character-profile__long-copy">{character.personality}</p>

              {depth.length > 0 && (
                <div className="character-profile__dna">
                  {depth.map((item) => (
                    <article key={item.label}>
                      <small>{item.label}</small>
                      <p>{item.value}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {hasWorldSection && (
            <section className="character-profile__section">
              <div className="character-profile__section-heading">
                <span className="character-profile__section-icon"><BookOpen size={17} /></span>
                <div>
                  <small>STORY CONTEXT</small>
                  <h2>World & scenario</h2>
                </div>
              </div>

              <div className="character-profile__context-grid">
                {character.world && (
                  <article>
                    <small>WORLD</small>
                    <p>{character.world}</p>
                  </article>
                )}
                {character.scenario && (
                  <article>
                    <small>SCENARIO</small>
                    <p>{character.scenario}</p>
                  </article>
                )}
              </div>
            </section>
          )}

          {hasVoiceSection && (
            <section className="character-profile__section character-profile__section--quiet">
              <div className="character-profile__section-heading">
                <span className="character-profile__section-icon"><Volume2 size={17} /></span>
                <div>
                  <small>BEHAVIOR</small>
                  <h2>Voice & boundaries</h2>
                </div>
              </div>

              <div className="character-profile__context-grid">
                {character.speechStyle && (
                  <article>
                    <small>SPEECH STYLE</small>
                    <p>{character.speechStyle}</p>
                  </article>
                )}
                {character.boundaries && (
                  <article>
                    <small>BOUNDARIES</small>
                    <p>{character.boundaries}</p>
                  </article>
                )}
              </div>
            </section>
          )}

          {character.firstMessage && (
            <section className="character-profile__opening">
              <div className="character-profile__opening-label">
                <Quote size={17} />
                <span>OPENING SCENE</span>
              </div>
              <blockquote>{character.firstMessage}</blockquote>
              <button onClick={() => onNewStory(character)}>
                Start from the beginning <ChevronRight size={16} />
              </button>
            </section>
          )}
        </main>

        <aside className="character-profile__aside">
          <section className="character-profile__stories">
            <header>
              <div>
                <small>YOUR STORIES</small>
                <h2>With {character.name}</h2>
              </div>
              <button onClick={() => onNewStory(character)} aria-label="Start new story">
                <Plus size={17} />
              </button>
            </header>

            {loading ? (
              <p className="character-profile__empty">Loading your stories…</p>
            ) : stories.length ? (
              <div className="character-profile__story-list">
                {stories.map((story, index) => (
                  <button key={story.id} onClick={() => onOpenStory(character, story.id)}>
                    <span className="character-profile__story-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="character-profile__story-copy">
                      <strong>{story.title || `${character.name} story`}</strong>
                      <small>{story.branch_parent_id ? "Branch · " : ""}{formatDate(story.updated_at)}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="character-profile__empty character-profile__empty--stories">
                <MessageCircle size={21} />
                <p>No stories yet.</p>
                <button onClick={() => onNewStory(character)}>Begin the first one</button>
              </div>
            )}
          </section>

          <section className="character-profile__quick-card">
            <small>STORY STYLE</small>
            <div>
              <span>Response</span>
              <strong>{formatSetting(character.responseLength)}</strong>
            </div>
            <div>
              <span>Narration</span>
              <strong>{formatSetting(character.narrationStyle)}</strong>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function formatSetting(value) {
  if (!value) return "Balanced";
  return String(value).replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

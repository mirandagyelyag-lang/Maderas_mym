import { Heart, MessageCircle, MoreHorizontal, Pencil, Tag, Trash2 } from "lucide-react";
import { useState } from "react";

function CharacterCard({ character, onOpen, onEdit, onDelete, onFavorite, onTags }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="character-card character-card--editorial" style={{ "--character-color": character.color }}>
      <button className="character-card__main" onClick={() => onOpen(character)}>
        <div className="character-card__portrait">
          {character.coverUrl || character.imageUrl ? (
            <img src={character.coverUrl || character.imageUrl} alt="" />
          ) : (
            <span className="character-card__initials">{character.initials}</span>
          )}
          <span className="character-card__portrait-shade" />
          <span className="character-card__avatar">
            {character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.initials}
          </span>
        </div>

        <div className="character-card__content">
          <span className="character-card__role">{character.role}</span>
          <h3>{character.name}</h3>
          <p>{character.description || "A new story is waiting to begin."}</p>
        </div>
      </button>

      <div className="character-card__floating-actions">
        {onFavorite && (
          <button
            className={`character-card__favorite${character.isFavorite ? " active" : ""}`}
            onClick={() => onFavorite(character.id)}
            aria-label={character.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={16} fill={character.isFavorite ? "currentColor" : "none"} />
          </button>
        )}

        {(onEdit || onDelete || onTags) && (
          <button className="character-card__more" onClick={() => setMenuOpen((current) => !current)} aria-label="Character options">
            <MoreHorizontal size={17} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="character-card__menu">
          {onEdit && <button onClick={() => { setMenuOpen(false); onEdit(character); }}><Pencil size={14} />Edit</button>}
          {onTags && <button onClick={() => { setMenuOpen(false); onTags(character); }}><Tag size={14} />Tags</button>}
          {onDelete && <button className="danger" onClick={() => { setMenuOpen(false); onDelete(character); }}><Trash2 size={14} />Delete</button>}
        </div>
      )}

      <footer className="character-card__footer">
        <div className="character-card__tags">
          {(character.tags || []).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <button className="character-card__chat" onClick={() => onOpen(character)}>
          <MessageCircle size={16} />
          <span>Open</span>
        </button>
      </footer>
    </article>
  );
}

export default CharacterCard;

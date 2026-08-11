import { Heart, PenLine, Search, Sparkles, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import CharacterCard from "../components/CharacterCard";
import { useCharacters } from "../context/CharactersContext";
import { useSettings } from "../context/SettingsContext";
import { useFeedback } from "../context/FeedbackContext";
import "../styles/my-characters.css";

function MyCharacters({ onCreateCharacter, onOpenCharacter, onEditCharacter }) {
  const { characters, deleteCharacter, toggleFavorite, updateTags } = useCharacters();
  const { settings } = useSettings();
  const { confirmAction, scheduleDeletion } = useFeedback();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [tagEditor, setTagEditor] = useState(null);
  const [tagValue, setTagValue] = useState("");

  const tags = useMemo(() => [...new Set(characters.flatMap((character) => character.tags || []))].sort(), [characters]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return characters.filter((character) => {
      const matchesQuery = !query || `${character.name} ${character.role} ${character.description} ${character.world} ${(character.tags || []).join(" ")}`.toLowerCase().includes(query);
      const matchesFavorite = filter !== "favorites" || character.isFavorite;
      const matchesTag = !tagFilter || character.tags?.includes(tagFilter);
      return matchesQuery && matchesFavorite && matchesTag;
    }).sort((a,b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [characters, search, filter, tagFilter]);

  async function handleDelete(character) {
    const approved = !settings.confirmBeforeDelete || await confirmAction({ title: `Delete ${character.name}?`, message: "Every conversation and memory connected to this character will also be deleted.", confirmLabel: "Delete character" });
    if (!approved) return;
    scheduleDeletion({ message: `Deleting ${character.name}`, onCommit: () => deleteCharacter(character.id), onError: (error) => { console.error(error); window.alert("We couldn't delete this character."); } });
  }

  function openTags(character) { setTagEditor(character); setTagValue((character.tags || []).join(", ")); }
  async function saveTags(event) {
    event.preventDefault();
    await updateTags(tagEditor.id, tagValue.split(","));
    setTagEditor(null);
  }

  if (characters.length === 0) return <section className="my-characters-empty"><span className="my-characters-empty__symbol"><Sparkles size={30}/></span><p>YOUR PRIVATE COLLECTION</p><h1>My characters</h1><span className="my-characters-empty__line"/><p>The personalities and worlds you create will live here.</p><button className="primary-button" onClick={onCreateCharacter}><PenLine size={18}/><span>Create your first character</span></button></section>;

  return <section className="my-characters">
    <header className="my-characters__header"><div><p>YOUR PRIVATE COLLECTION</p><h1>My characters</h1><span>{characters.length} {characters.length===1?"character":"characters"}</span></div><button className="primary-button" onClick={onCreateCharacter}><PenLine size={18}/><span>Create a character</span></button></header>
    <div className="collection-tools"><label><Search size={18}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search characters, worlds or tags..."/>{search&&<button onClick={()=>setSearch("")}><X size={15}/></button>}</label><div><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All</button><button className={filter==="favorites"?"active":""} onClick={()=>setFilter("favorites")}><Heart size={14}/>Favorites</button><select value={tagFilter} onChange={(event)=>setTagFilter(event.target.value)}><option value="">Every tag</option>{tags.map((tag)=><option key={tag}>{tag}</option>)}</select></div></div>
    {filtered.length ? <div className="character-grid">{filtered.map((character)=><CharacterCard key={character.id} character={character} onOpen={onOpenCharacter} onEdit={onEditCharacter} onDelete={handleDelete} onFavorite={toggleFavorite} onTags={openTags}/>)}</div> : <div className="collection-empty"><Search size={26}/><h2>No characters found</h2><p>Try another search or remove a filter.</p></div>}
    {tagEditor&&<div className="tag-modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setTagEditor(null)}><form className="tag-modal" onSubmit={saveTags}><header><span><Tag size={18}/></span><div><small>ORGANIZE CHARACTER</small><h2>{tagEditor.name}'s tags</h2></div><button type="button" onClick={()=>setTagEditor(null)}><X size={19}/></button></header><label>Tags separated by commas<input autoFocus value={tagValue} onChange={(event)=>setTagValue(event.target.value)} placeholder="university, romance, favorite"/><small>Use up to 12 short tags.</small></label><footer><button type="button" onClick={()=>setTagEditor(null)}>Cancel</button><button type="submit">Save tags</button></footer></form></div>}
  </section>;
}
export default MyCharacters;

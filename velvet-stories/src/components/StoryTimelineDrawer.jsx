import { Clock3, MapPin, RefreshCw, Sparkles, UsersRound, X } from "lucide-react";

export default function StoryTimelineDrawer({ open, onClose, conversation, onRefresh, refreshing = false }) {
  if (!open) return null;
  const scene = conversation?.sceneState || {};
  const timeline = Array.isArray(conversation?.storyTimeline) ? conversation.storyTimeline : [];
  const present = Array.isArray(scene.present) ? scene.present : [];
  const absent = Array.isArray(scene.absent) ? scene.absent : [];

  return (
    <div className="timeline-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="timeline-drawer" role="dialog" aria-modal="true" aria-labelledby="story-timeline-title">
        <header>
          <div><small>STORY CONTINUITY</small><h2 id="story-timeline-title">Timeline</h2></div>
          <button type="button" onClick={onClose} aria-label="Close timeline"><X size={20}/></button>
        </header>

        <section className="timeline-scene-card">
          <div className="timeline-scene-card__heading"><Sparkles size={17}/><strong>Current scene</strong></div>
          <div className="timeline-scene-grid">
            <span><MapPin size={15}/><b>Location</b><em>{scene.location || "Velvet is still learning the scene"}</em></span>
            <span><Clock3 size={15}/><b>Time</b><em>{scene.time || "Not established"}</em></span>
            <span><UsersRound size={15}/><b>Present</b><em>{present.length ? present.join(", ") : "Not established"}</em></span>
          </div>
          {scene.situation && <p>{scene.situation}</p>}
          {absent.length > 0 && <small>Off-screen: {absent.join(", ")}</small>}
        </section>

        <section className="timeline-events">
          <div className="timeline-events__title"><strong>Major story beats</strong><span>{timeline.length}</span></div>
          {timeline.length ? (
            <ol>{timeline.map((item, index) => (
              <li key={`${item?.label || item?.event || "beat"}-${index}`}>
                <span>{index + 1}</span>
                <div><strong>{typeof item === "string" ? item : item?.label || item?.event || "Story beat"}</strong>{typeof item !== "string" && item?.detail && <p>{item.detail}</p>}</div>
              </li>
            ))}</ol>
          ) : <div className="timeline-empty"><Clock3 size={24}/><p>Major moments will appear here automatically as the story grows.</p></div>}
        </section>

        <footer><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? <RefreshCw className="spin" size={16}/> : <RefreshCw size={16}/>}Refresh continuity</button></footer>
      </aside>
    </div>
  );
}

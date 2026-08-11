import { useEffect, useState } from "react";

import CreateCharacterModal from "./components/CreateCharacterModal";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import CharacterDetail from "./pages/CharacterDetail";
import Chats from "./pages/Chats";
import MyCharacters from "./pages/MyCharacters";
import Memories from "./pages/Memories";
import Profile from "./pages/Profile";
import Personas from "./pages/Personas";
import Lorebooks from "./pages/Lorebooks";
import Settings from "./pages/Settings";
import PWAStatus from "./components/PWAStatus";
import { useChats } from "./context/ChatsContext";
import WelcomeSplash from "./components/WelcomeSplash";
import "./App.css";

function App() {
  const { user, authLoading } = useAuth();
  const { createNewConversation } = useChats();
  const [activePage, setActivePage] = useState(() => {
    const requestedPage = new URLSearchParams(window.location.search).get("open");
    return ["characters", "chats", "memories", "personas", "lorebooks", "profile", "settings"].includes(requestedPage)
      ? requestedPage
      : "chats";
  });
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [previewCharacter, setPreviewCharacter] = useState(null);

  useEffect(() => {
    const currentState = window.history.state;

    if (!currentState?.velvetNavigation) {
      window.history.replaceState(
        {
          velvetNavigation: true,
          page: activePage,
          character: null,
          conversationId: null,
        },
        ""
      );
    }

    function handleBrowserBack(event) {
      const state = event.state;

      if (!state?.velvetNavigation) {
        setSelectedCharacter(null);
        setSelectedConversationId(null);
        setPreviewCharacter(null);
        setActivePage("chats");
        return;
      }

      setActivePage(state.page || "chats");
      setSelectedCharacter(state.character || null);
      setSelectedConversationId(state.conversationId || null);
      setPreviewCharacter(null);
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    window.addEventListener("popstate", handleBrowserBack);
    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, []);

  if (authLoading) {
    return (
      <main className="app-loading">
        <span>✦</span>
        <p>Opening Velvet...</p>
      </main>
    );
  }

  if (!user) return <Auth />;

  function navigate(page, options = {}) {
    setSelectedCharacter(null);
    setSelectedConversationId(null);
    setPreviewCharacter(null);
    setActivePage(page);

    const nextState = {
      velvetNavigation: true,
      page,
      character: null,
      conversationId: null,
    };

    if (options.replace) {
      window.history.replaceState(nextState, "");
    } else {
      window.history.pushState(nextState, "");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCharacter(character, conversationId = null) {
    setPreviewCharacter(null);
    setSelectedCharacter(character);
    setSelectedConversationId(conversationId);
    setActivePage("chats");

    window.history.pushState(
      {
        velvetNavigation: true,
        page: "chats",
        character,
        conversationId,
      },
      ""
    );
  }


  function openCharacterProfile(character) {
    setSelectedCharacter(null);
    setSelectedConversationId(null);
    setPreviewCharacter(character);
    window.history.pushState({ velvetNavigation: true, page: activePage, character: null, conversationId: null }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startNewStoryFromProfile(character) {
    const created = await createNewConversation(character);
    openCharacter(character, created.conversationId);
  }
  function leaveCurrentChat() {
    if (window.history.state?.velvetNavigation && window.history.state?.character) {
      window.history.back();
      return;
    }

    navigate("chats", { replace: true });
  }

  function renderPage() {
    if (previewCharacter) {
      return (
        <CharacterDetail
          character={previewCharacter}
          onBack={() => { setPreviewCharacter(null); window.history.back(); }}
          onContinue={(character) => openCharacter(character)}
          onNewStory={startNewStoryFromProfile}
          onOpenStory={openCharacter}
          onEdit={(character) => {
            setEditingCharacter(character);
            setCreatorOpen(true);
          }}
        />
      );
    }

    if (selectedCharacter) {
      return (
        <Chat
          character={selectedCharacter}
          conversationId={selectedConversationId}
          onBack={leaveCurrentChat}
          onDeleted={() => navigate("chats", { replace: true })}
        />
      );
    }

    if (activePage === "characters") {
      return (
        <MyCharacters
          onCreateCharacter={() => {
            setEditingCharacter(null);
            setCreatorOpen(true);
          }}
          onOpenCharacter={openCharacterProfile}
          onEditCharacter={(character) => {
            setEditingCharacter(character);
            setCreatorOpen(true);
          }}
        />
      );
    }

    if (activePage === "chats") {
      return (
        <Chats
          onOpenCharacter={openCharacter}
          onBrowseCharacters={() => navigate("characters")}
        />
      );
    }

    if (activePage === "memories") {
      return (
        <Memories
          onBrowseCharacters={() => navigate("characters")}
          onOpenCharacter={openCharacter}
        />
      );
    }

    if (activePage === "personas") return <Personas onBack={() => navigate("profile")} />;

    if (activePage === "lorebooks") return <Lorebooks onBack={() => navigate("profile")} />;

    if (activePage === "settings") return <Settings onBack={() => navigate("profile")} />;

    if (activePage === "profile") return <Profile onManagePersonas={() => navigate("personas")} onManageLorebooks={() => navigate("lorebooks")} onOpenSettings={() => navigate("settings")} />;

    return (
      <Chats
        onOpenCharacter={openCharacter}
        onBrowseCharacters={() => navigate("characters")}
      />
    );
  }

  return (
    <>
    <WelcomeSplash />
    <div className={`app ${selectedCharacter ? "app--chat" : ""}`}>
      {!selectedCharacter && (
        <Sidebar activePage={["personas", "lorebooks", "settings"].includes(activePage) ? "profile" : activePage} onNavigate={navigate} />
      )}

      <main className="app__content">{renderPage()}</main>

      {creatorOpen && (
        <CreateCharacterModal
          character={editingCharacter}
          onClose={() => {
            setCreatorOpen(false);
            setEditingCharacter(null);
          }}
          onCreated={(character) => {
            setCreatorOpen(false);
            setEditingCharacter(null);
            if (!editingCharacter) openCharacter(character);
          }}
        />
      )}
      <PWAStatus />
    </div>
    </>
  );
}

export default App;

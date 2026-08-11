import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";

const CharactersContext = createContext();

export function CharactersProvider({ children }) {
  const { user } = useAuth();

  const [characters, setCharacters] = useState([]);
  const [charactersLoading, setCharactersLoading] =
    useState(true);

  const [charactersError, setCharactersError] =
    useState("");

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setCharactersLoading(false);
      setCharactersError("");
      return;
    }

    loadCharacters();
  }, [user?.id]);

  async function loadCharacters() {
    if (!user) {
      return;
    }

    try {
      setCharactersLoading(true);
      setCharactersError("");

      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setCharacters(
        (data || []).map(convertDatabaseCharacter)
      );
    } catch (error) {
      console.error("Error loading characters:", error);
      setCharactersError(
        "We couldn't load your characters."
      );
    } finally {
      setCharactersLoading(false);
    }
  }

  async function createCharacter(characterData) {
    if (!user) {
      throw new Error(
        "You need to sign in before creating a character."
      );
    }

    const imageUrl = characterData.imageFile
      ? await uploadCharacterMedia(characterData.imageFile, "avatar")
      : characterData.imageUrl || null;
    const coverUrl = characterData.coverFile
      ? await uploadCharacterMedia(characterData.coverFile, "cover")
      : characterData.coverUrl || null;

    const databaseCharacter = {
      user_id: user.id,
      name: characterData.name.trim(),
      role: characterData.role.trim(),

      description:
        characterData.description?.trim() || null,

      personality:
        characterData.personality.trim(),

      relationship:
        characterData.relationship?.trim() || null,

      world:
        characterData.world?.trim() || null,

      character_values: characterData.values?.trim() || null,
      fears: characterData.fears?.trim() || null,
      habits: characterData.habits?.trim() || null,
      contradictions: characterData.contradictions?.trim() || null,
      speech_style: characterData.speechStyle?.trim() || null,
      boundaries: characterData.boundaries?.trim() || null,
      scenario: characterData.scenario?.trim() || null,
      example_dialogue: characterData.exampleDialogue?.trim() || null,

      response_length:
        characterData.responseLength || "balanced",

      narration_style:
        characterData.narrationStyle || "balanced",

      first_message:
        characterData.firstMessage.trim(),

      image_url: imageUrl,

      cover_url: coverUrl,

      color:
        characterData.color || "#7a2942",
    };

    const { data, error } = await supabase
      .from("characters")
      .insert(databaseCharacter)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const newCharacter =
      convertDatabaseCharacter(data);

    setCharacters((currentCharacters) => [
      newCharacter,
      ...currentCharacters,
    ]);

    return newCharacter;
  }

  async function updateCharacter(characterId, characterData) {
    if (!user) throw new Error("You need to sign in before editing a character.");

    const imageUrl = characterData.imageFile
      ? await uploadCharacterMedia(characterData.imageFile, "avatar")
      : characterData.imageUrl?.trim() || null;
    const coverUrl = characterData.coverFile
      ? await uploadCharacterMedia(characterData.coverFile, "cover")
      : characterData.coverUrl?.trim() || null;

    const databaseCharacter = {
      name: characterData.name.trim(),
      role: characterData.role.trim(),
      description: characterData.description?.trim() || null,
      personality: characterData.personality.trim(),
      relationship: characterData.relationship?.trim() || null,
      world: characterData.world?.trim() || null,
      character_values: characterData.values?.trim() || null,
      fears: characterData.fears?.trim() || null,
      habits: characterData.habits?.trim() || null,
      contradictions: characterData.contradictions?.trim() || null,
      speech_style: characterData.speechStyle?.trim() || null,
      boundaries: characterData.boundaries?.trim() || null,
      scenario: characterData.scenario?.trim() || null,
      example_dialogue: characterData.exampleDialogue?.trim() || null,
      response_length: characterData.responseLength || "balanced",
      narration_style: characterData.narrationStyle || "balanced",
      first_message: characterData.firstMessage.trim(),
      image_url: imageUrl,
      cover_url: coverUrl,
      color: characterData.color || "#7a2942",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("characters")
      .update(databaseCharacter)
      .eq("id", characterId)
      .select()
      .single();

    if (error) throw error;

    const updatedCharacter = convertDatabaseCharacter(data);
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) =>
        character.id === characterId ? updatedCharacter : character
      )
    );

    return updatedCharacter;
  }

  async function uploadCharacterMedia(file, kind) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}-${kind}.${extension}`;
    const { error } = await supabase.storage
      .from("character-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from("character-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function enhanceCharacterDraft(characterData) {
    const { data, error } = await supabase.functions.invoke("character-chat", {
      body: {
        action: "character_assist",
        draft: {
          name: characterData.name || "",
          role: characterData.role || "",
          description: characterData.description || "",
          personality: characterData.personality || "",
          relationship: characterData.relationship || "",
          world: characterData.world || "",
          values: characterData.values || "",
          fears: characterData.fears || "",
          habits: characterData.habits || "",
          contradictions: characterData.contradictions || "",
          speechStyle: characterData.speechStyle || "",
          boundaries: characterData.boundaries || "",
          scenario: characterData.scenario || "",
          exampleDialogue: characterData.exampleDialogue || "",
        },
      },
    });
    if (error) throw error;
    return data?.suggestions || {};
  }

  async function deleteCharacter(characterId) {
    const { error } = await supabase
      .from("characters")
      .delete()
      .eq("id", characterId);

    if (error) {
      throw error;
    }

    setCharacters((currentCharacters) =>
      currentCharacters.filter(
        (character) =>
          character.id !== characterId
      )
    );
  }

  async function toggleFavorite(characterId) {
    const character = characters.find((item) => item.id === characterId);
    if (!character) return null;
    const isFavorite = !character.isFavorite;
    const { data, error } = await supabase
      .from("characters")
      .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
      .eq("id", characterId)
      .select()
      .single();
    if (error) throw error;
    const updated = convertDatabaseCharacter(data);
    setCharacters((current) => current.map((item) => item.id === characterId ? updated : item));
    return updated;
  }

  async function updateTags(characterId, tags) {
    const cleanTags = [...new Set((tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
    const { data, error } = await supabase
      .from("characters")
      .update({ tags: cleanTags, updated_at: new Date().toISOString() })
      .eq("id", characterId)
      .select()
      .single();
    if (error) throw error;
    const updated = convertDatabaseCharacter(data);
    setCharacters((current) => current.map((item) => item.id === characterId ? updated : item));
    return updated;
  }

  return (
    <CharactersContext.Provider
      value={{
        characters,
        charactersLoading,
        charactersError,
        loadCharacters,
        createCharacter,
        updateCharacter,
        enhanceCharacterDraft,
        deleteCharacter,
        toggleFavorite,
        updateTags,
      }}
    >
      {children}
    </CharactersContext.Provider>
  );
}

function convertDatabaseCharacter(character) {
  return {
    id: character.id,
    userId: character.user_id,

    name: character.name,
    role: character.role,
    description: character.description || "",
    personality: character.personality,
    relationship: character.relationship || "",
    world: character.world || "",
    values: character.character_values || "",
    fears: character.fears || "",
    habits: character.habits || "",
    contradictions: character.contradictions || "",
    speechStyle: character.speech_style || "",
    boundaries: character.boundaries || "",
    scenario: character.scenario || "",
    exampleDialogue: character.example_dialogue || "",

    responseLength: character.response_length,
    narrationStyle: character.narration_style,
    firstMessage: character.first_message,

    imageUrl: character.image_url || "",
    coverUrl: character.cover_url || "",
    color: character.color || "#7a2942",
    isFavorite: Boolean(character.is_favorite),
    tags: Array.isArray(character.tags) ? character.tags : [],

    initials: createInitials(character.name),
    likes: "0",

    style: getStyleName(
      character.narration_style
    ),

    createdAt: character.created_at,
    updatedAt: character.updated_at,
  };
}

function createInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function getStyleName(narrationStyle) {
  if (narrationStyle === "dialogue") {
    return "Dialogue focused";
  }

  if (narrationStyle === "immersive") {
    return "Immersive roleplay";
  }

  return "Balanced storytelling";
}

export function useCharacters() {
  const context = useContext(CharactersContext);

  if (!context) {
    throw new Error(
      "useCharacters debe utilizarse dentro de CharactersProvider"
    );
  }

  return context;
}

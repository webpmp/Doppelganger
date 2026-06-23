import React, { useState, useMemo, useRef, useEffect, FormEvent, Dispatch, SetStateAction } from "react";
import { 
  ArrowRight, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  User, 
  Cpu, 
  Layers,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ActiveNode, Edge, stripLabelNumbering, classifyNodeLevel, formatNodeLabel } from "../types";
import KnowledgeGraphCanvas from "./KnowledgeGraphCanvas";

const PROFILE_IMAGES: { [handle: string]: string } = {
  "@chris.adkins": "/image-chris-adkins.png",
  "@alex.morgan": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "@jordan.lee": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
};

let hasInitializedAppSession = false;

const getProfileInfo = (handle: string, defaultDisplayName?: string) => {
  const normalized = (handle || "").toLowerCase();
  if (normalized.includes("chris.adkins")) {
    return { name: "Chris Adkins", title: "Principal Design Program Manager", handle: "@chris.adkins" };
  }
  if (normalized.includes("alex.morgan")) {
    return { name: "Alex Morgan", title: "Staff Engineer, Platform", handle: "@alex.morgan" };
  }
  if (normalized.includes("jordan.lee")) {
    return { name: "Jordan Lee", title: "Product Operations Lead", handle: "@jordan.lee" };
  }

  // Fallback parsers if there's any other string or team (e.g. "Brand Team Shared")
  let name = defaultDisplayName || "Unknown Creator";
  let title = "Team Member";
  let displayHandle = handle || "@creator";

  if (name.includes("(")) {
    const parts = name.split("(");
    name = parts[0].trim();
    title = parts[1].replace(")", "").trim();
  }

  return { name, title, handle: displayHandle };
};

function toTitleCase(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed.toUpperCase() === "NEW THREAD") return "New Thread";
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return "";
      if (word.startsWith("@")) {
        const namePart = word.slice(1).split(".");
        return namePart.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

interface V2Thread {
  id: string;
  question: string;
  answer: string;
  referencedNodes: string[];
  isQuerying: boolean;
  isMinimized: boolean;
  routingTrigger: boolean;
  timestamp: string;
  ownerHandle?: string;
  topicTitle?: string;
  progressPercent?: number;
  progressPhase?: string;
}

interface V2Session {
  id: string;
  topicTitle: string;
  history: V2Thread[];
}

interface FavoriteTopic {
  id: string; // The thread ID
  title: string; // themeTitle
  associatedNodeId: string | null;
  history: V2Thread[];
  timestamp: string;
}

interface V2GuidedFlowProps {
  graphState: {
    activeNodes: ActiveNode[];
    notes: any[];
    edges: Edge[];
  };
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  unlockedTokens: string[];
  activeProfileHandle: string;
  v2Threads: V2Thread[];
  setV2Threads: Dispatch<SetStateAction<V2Thread[]>>;
  v2FocusedThreadId: string | null;
  setV2FocusedThreadId: (id: string | null) => void;
  v2Input: string;
  setV2Input: (val: string) => void;
  handleV2Submit: (e?: FormEvent, customText?: string) => Promise<void>;
  handleResetV2Thread: () => void;
  ownerHandle?: string;
  onSwitchProfile?: (handle: string) => void;
  openDoppelgangerTab?: (handle: string) => void;
  onOpenSettings?: () => void;
}

// Generate a friendly, non-technical title based on the user's question
function getQuestionTheme(question: string): string {
  if (!question) return "Discussion Thread";
  
  let q = question.trim();
  
  // Convert handles to proper names
  q = q.replace(/@jordan\.lee/gi, "Jordan Lee");
  q = q.replace(/@chris\.adkins/gi, "Chris Adkins");
  q = q.replace(/@alex\.morgan/gi, "Alex Morgan");
  q = q.replace(/@creator/gi, "Creator");

  const lower = q.toLowerCase();

  // If question is asking about what they are doing / working on
  if (lower.includes("working on") || lower.includes("doing") || lower.includes("tasks")) {
    if (lower.includes("jordan")) return "Jordan Lee’s Active Tasks";
    if (lower.includes("chris")) return "Chris Adkins’ Active Tasks";
    if (lower.includes("alex")) return "Alex Morgan’s Active Tasks";
    return "Current Operational Workloads";
  }

  // Mobile App Redesign updates
  if (lower.includes("mobile") && (lower.includes("redesign") || lower.includes("update"))) {
    return "Mobile App Redesign Updates";
  }

  // Design sprints planning / ownership
  if (lower.includes("design sprint") || lower.includes("sprint")) {
    if (lower.includes("owner") || lower.includes("who owns")) {
      return "Ownership of Design Sprints Planning";
    }
    return "Design Sprints Planning Contributors";
  }

  if (lower.includes("branding") && lower.includes("guidelines")) {
    return "Branding Update Guidelines";
  }
  
  if (lower.includes("kinetic") && lower.includes("type")) {
    return "Kinetic Type Prototype Studies";
  }

  // Convert raw query using sentence/title case without raw username/all-caps transform
  // Remove questions starters
  let clean = q.replace(/^(what is|show me|who owns|what are|where is|how to)\s+/gi, "");
  clean = clean.replace(/[?.!]/g, "").trim();

  if (!clean) return "Discussion Summary";

  // Convert to Title Case
  return clean
    .split(/\s+/)
    .map(w => {
      if (w.startsWith("@")) {
        const namePart = w.slice(1).split(".");
        return namePart.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

// Helper to extract a truncated key phrase from the first generated AI response block
function extractKeyPhraseFromAnswer(answer: string): string {
  if (!answer) return "";
  
  // Clean markup, bolding stars, brackets, dashes
  const cleanText = answer
    .replace(/[#*`_\[\]()\-]/g, "")
    .replace(/Searching notes\.\.\./i, "")
    .replace(/Notice:.*/i, "")
    .trim();
    
  if (!cleanText) return "";

  // Split into sentences, take the first non-empty sentence
  const sentences = cleanText.split(/[.!?:]/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return "";

  const firstSentence = sentences[0];
  // Break into words
  const words = firstSentence.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return "";

  // Remove common filler words to extract the true key phrase/nouns
  const fillers = new Set([
    "the", "a", "an", "this", "that", "these", "those", "is", "are", 
    "was", "were", "to", "for", "with", "by", "from", "at", "on", 
    "in", "of", "and", "but", "or", "so", "if", "then", "indeed", 
    "therefore", "it", "they", "we", "having", "has", "have"
  ]);
  const filteredWords = words.filter(w => !fillers.has(w.toLowerCase()));

  const selectedWords = filteredWords.length > 0 ? filteredWords : words;
  const chunk = selectedWords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  if (chunk.length > 22) {
    return chunk.slice(0, 20) + "...";
  }
  return chunk;
}

// Contextually relevant search placeholders to help users refine the active discussion topic
function getFollowUpPlaceholder(lastQuestion?: string): string {
  return "Ask a follow up question...";
}

function TypewriterFadingText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setDisplayedText("");
    setIsTypingDone(false);
    setIsFading(false);
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsTypingDone(true);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  useEffect(() => {
    if (isTypingDone) {
      const timeout = setTimeout(() => {
        setIsFading(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isTypingDone]);

  return (
    <div 
      className="text-xs font-sans text-zinc-500 py-1.5 font-semibold text-zinc-400 select-none"
      style={{ 
        opacity: isFading ? 0 : 1, 
        transition: isFading ? 'opacity 10s linear' : 'none' 
      }}
    >
      {displayedText}
    </div>
  );
}

const QueryProgress = ({ percent, phase }: { percent?: number; phase?: string }) => {
  const [maxProgress, setMaxProgress] = useState(0);

  useEffect(() => {
    if (percent !== undefined && percent > maxProgress) {
      setMaxProgress(percent);
    }
  }, [percent, maxProgress]);

  const displayPercent = percent !== undefined ? Math.max(percent, maxProgress) : maxProgress;
  const displayPhase = phase || "Processing request";

  return (
    <div className="flex items-center gap-2 text-zinc-500 font-mono text-[10px] py-1">
      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
      <span>{displayPercent}% — {displayPhase}</span>
    </div>
  );
};

export default function V2GuidedFlow({
  graphState,
  selectedNodeId,
  onSelectNode,
  unlockedTokens,
  activeProfileHandle,
  v2Threads,
  setV2Threads,
  v2FocusedThreadId,
  setV2FocusedThreadId,
  v2Input,
  setV2Input,
  handleV2Submit,
  handleResetV2Thread,
  ownerHandle,
  onSwitchProfile,
  openDoppelgangerTab,
  onOpenSettings,
}: V2GuidedFlowProps) {
  if (typeof window !== "undefined" && !hasInitializedAppSession) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("doppelganger_v2_sessions_v2_") || key.startsWith("doppelganger_v2_active_session_id_v2_"))) {
        localStorage.removeItem(key);
        i--;
      }
    }
    hasInitializedAppSession = true;
  }

  const [currentNodePositions, setCurrentNodePositions] = useState<{ [nodeId: string]: { x: number; y: number } } | null>(null);
  const [mapFilterMode, setMapFilterMode] = useState<'cited' | 'all'>('cited');

  const bypassSessionSyncRef = useRef(false);

  const handleDoppelgangerClickFromCard = (handle: string) => {
    bypassSessionSyncRef.current = true;
    setMapFilterMode('all');
    if (onSwitchProfile) {
      onSwitchProfile(handle);
    }
  };

  // 1. EXTEND THE CORE SEATING MEMORY STATE
  // Tabbed sessions saved on local storage (shared across profiles for seamless switching)
  const [sessions, setSessions] = useState<V2Session[]>(() => {
    const saved = localStorage.getItem('doppelganger_v2_sessions_v2_shared');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    const oldSaved = localStorage.getItem(`doppelganger_v2_sessions_v2_@chris.adkins`);
    if (oldSaved) {
      try {
        const parsed = JSON.parse(oldSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    return [
      {
        id: "session-1",
        topicTitle: "Mobile App Redesign",
        history: []
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('doppelganger_v2_active_session_id_v2_shared');
    if (saved) return saved;
    const oldSaved = localStorage.getItem(`doppelganger_v2_active_session_id_v2_@chris.adkins`);
    if (oldSaved) return oldSaved;
    return "session-1";
  });

  const syncRef = useRef(false);

  // Scroll Metrics
  const [scrollMetrics, setScrollMetrics] = useState<{ [id: string]: { scale: number; opacity: number; blur: number } }>({});

  const [favorites, setFavorites] = useState<FavoriteTopic[]>(() => {
    const saved = localStorage.getItem(`doppelganger_v2_favorites_${activeProfileHandle}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    return [];
  });

  const [headerMode, setHeaderMode] = useState<'topics' | 'favorites'>(() => {
    const saved = localStorage.getItem(`doppelganger_v2_favorites_${activeProfileHandle}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return 'favorites';
        }
      } catch (_) {}
    }
    return 'topics';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Autocomplete suggestions states
  const [autocomplete, setAutocomplete] = useState<{
    isOpen: boolean;
    type: "tag" | "doppelganger" | null;
    triggerIndex: number;
    searchQuery: string;
    selectedIndex: number;
    inputId: string | null;
  }>({
    isOpen: false,
    type: null,
    triggerIndex: -1,
    searchQuery: "",
    selectedIndex: 0,
    inputId: null
  });

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    (graphState?.activeNodes || []).forEach((node: any) => {
      if (node.tags) {
        node.tags.split(",").forEach((t: string) => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) {
            tagsSet.add(trimmed);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [graphState?.activeNodes]);

  const doppelgangersList = useMemo(() => {
    const list = [
      { handle: "@chris.adkins", name: "Chris Adkins" },
      { handle: "@alex.morgan", name: "Alex Morgan" },
      { handle: "@jordan.lee", name: "Jordan Lee" }
    ];
    // Dynamically pull others if they exist in activeNodes
    (graphState?.activeNodes || []).forEach((node: any) => {
      if (node.doppelgangerHandle && node.doppelgangerHandle.startsWith("@")) {
        const handleLower = node.doppelgangerHandle.toLowerCase();
        if (!list.some(d => d.handle.toLowerCase() === handleLower)) {
          list.push({
            handle: node.doppelgangerHandle,
            name: node.doppelganger || node.doppelgangerHandle.slice(1)
          });
        }
      }
    });
    return list;
  }, [graphState?.activeNodes]);

  const suggestions = useMemo(() => {
    if (!autocomplete.isOpen || !autocomplete.type) return [];
    const query = autocomplete.searchQuery.toLowerCase();
    
    if (autocomplete.type === "tag") {
      return allTags
        .filter(t => t.includes(query))
        .map(t => ({
          value: `#${t}`,
          label: t,
          sublabel: "Tag"
        }));
    } else {
      return doppelgangersList
        .filter(d => d.handle.toLowerCase().includes(query) || d.name.toLowerCase().includes(query))
        .map(d => ({
          value: d.handle,
          label: d.handle,
          sublabel: d.name
        }));
    }
  }, [autocomplete.isOpen, autocomplete.type, autocomplete.searchQuery, allTags, doppelgangersList]);

  const handleInputUpdate = (value: string, selectionStart: number, inputId: string) => {
    const textBeforeCursor = value.slice(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");
    const lastHashIdx = textBeforeCursor.lastIndexOf("#");

    let triggerChar: "@" | "#" | null = null;
    let triggerIndex = -1;

    // Determine the closest trigger character before the cursor with no spaces in between
    if (lastAtIdx !== -1 && (lastHashIdx === -1 || lastAtIdx > lastHashIdx)) {
      const textAfterTrigger = textBeforeCursor.slice(lastAtIdx);
      if (!textAfterTrigger.includes(" ")) {
        triggerChar = "@";
        triggerIndex = lastAtIdx;
      }
    } else if (lastHashIdx !== -1 && (lastAtIdx === -1 || lastHashIdx > lastAtIdx)) {
      const textAfterTrigger = textBeforeCursor.slice(lastHashIdx);
      if (!textAfterTrigger.includes(" ")) {
        triggerChar = "#";
        triggerIndex = lastHashIdx;
      }
    }

    if (triggerChar) {
      const searchQuery = textBeforeCursor.slice(triggerIndex + 1);
      setAutocomplete({
        isOpen: true,
        type: triggerChar === "@" ? "doppelganger" : "tag",
        triggerIndex,
        searchQuery,
        selectedIndex: 0,
        inputId
      });
    } else {
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
    }
  };

  const selectSuggestion = (valueToInsert: string, inputId: string) => {
    const inputElement = document.getElementById(inputId) as HTMLInputElement;
    if (!inputElement) return;

    const selectionStart = inputElement.selectionStart || 0;
    const textBeforeTrigger = v2Input.slice(0, autocomplete.triggerIndex);
    const textAfterCursor = v2Input.slice(selectionStart);
    const insertion = valueToInsert + " ";
    const newValue = textBeforeTrigger + insertion + textAfterCursor;

    setV2Input(newValue);
    setAutocomplete({
      isOpen: false,
      type: null,
      triggerIndex: -1,
      searchQuery: "",
      selectedIndex: 0,
      inputId: null
    });

    // Restore focus and move selection cursor right after the inserted word + space
    setTimeout(() => {
      inputElement.focus();
      const newPos = autocomplete.triggerIndex + insertion.length;
      inputElement.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, inputId: string) => {
    if (!autocomplete.isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAutocomplete(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % suggestions.length
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAutocomplete(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex - 1 + suggestions.length) % suggestions.length
      }));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const selected = suggestions[autocomplete.selectedIndex];
      if (selected) {
        selectSuggestion(selected.value, inputId);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
    }
  };

  const renderAutocompleteDropdown = (inputId: string) => {
    if (!autocomplete.isOpen || autocomplete.inputId !== inputId || suggestions.length === 0) return null;

    return (
      <div 
        className="absolute left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-xl border bg-slate-950/95 backdrop-blur-xl shadow-2xl p-1.5 flex flex-col gap-0.5 scrollbar-thin animate-fadeIn"
        style={{
          bottom: "100%",
          marginBottom: "8px",
          borderColor: "rgba(45, 212, 191, 0.2)"
        }}
      >
        {suggestions.map((item, idx) => {
          const isSelected = idx === autocomplete.selectedIndex;
          return (
            <div
              key={item.value}
              onClick={() => selectSuggestion(item.value, inputId)}
              onMouseEnter={() => setAutocomplete(prev => ({ ...prev, selectedIndex: idx }))}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                isSelected 
                  ? "bg-teal-500/10 text-teal-400 font-medium" 
                  : "text-zinc-300 hover:bg-zinc-900/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={isSelected ? "text-teal-400" : "text-zinc-500"}>
                  {autocomplete.type === "tag" ? "#" : "@"}
                </span>
                <span className="text-xs sm:text-[13px] font-mono">{item.label}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium font-mono">
                {item.sublabel}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const wrappedHandleV2Submit = async (e?: FormEvent, customText?: string) => {
    setMapFilterMode('cited');
    await handleV2Submit(e, customText);
    setHeaderMode('topics');
  };

  const isFavorited = (threadId: string, title?: string) => {
    const threadObj = v2Threads.find(t => t.id === threadId);
    const checkTitle = title || (threadObj ? ((!threadObj.isQuerying && threadObj.topicTitle) ? threadObj.topicTitle : "") : "");
    return favorites.some(fav => 
      fav.id === threadId || 
      (checkTitle && fav.title.trim().toLowerCase() === checkTitle.trim().toLowerCase())
    );
  };

  const removeFavorite = (favId: string, title?: string) => {
    setFavorites(prev => {
      const updated = prev.filter(fav => 
        fav.id !== favId && 
        (!title || fav.title.trim().toLowerCase() !== title.trim().toLowerCase())
      );
      if (updated.length === 0) {
        setHeaderMode('topics');
      }
      return updated;
    });

    const restoredSessionId = `restored-session-${favId}`;
    if (activeSessionId === restoredSessionId) {
      const updatedSessions = sessions.filter(s => s.id !== restoredSessionId);
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
      } else {
        const newId = `session-${Date.now()}`;
        const newSessionObj: V2Session = {
          id: newId,
          topicTitle: "New Thread",
          history: []
        };
        setSessions([newSessionObj]);
        setActiveSessionId(newId);
        onSelectNode(null);
        return;
      }
      setSessions(updatedSessions);
    }
  };

  const toggleFavorite = (thread: V2Thread) => {
    const themeTitle = (!thread.isQuerying && thread.topicTitle) ? toTitleCase(thread.topicTitle) : "";
    const associatedNodeId = thread.referencedNodes && thread.referencedNodes.length > 0 
      ? thread.referencedNodes[0] 
      : selectedNodeId;

    if (isFavorited(thread.id, themeTitle)) {
      removeFavorite(thread.id, themeTitle);
    } else {
      // Avoid adding if same title already exists
      const alreadyExists = favorites.some(fav => fav.title.trim().toLowerCase() === themeTitle.trim().toLowerCase());
      if (alreadyExists) return;

      const idx = v2Threads.findIndex(t => t.id === thread.id);
      const historyContext = v2Threads.slice(0, idx + 1).map(t => ({
        ...t,
        isQuerying: false
      }));
      const newFav: FavoriteTopic = {
        id: thread.id,
        title: themeTitle,
        associatedNodeId,
        history: historyContext,
        timestamp: new Date().toLocaleDateString()
      };
      setFavorites(prev => [newFav, ...prev]);
      // If a user has saved a favorite, show the top bar with the favorite selected and favorite tab
      setHeaderMode('favorites');
    }
  };

  const handleFavoriteTabClick = (fav: FavoriteTopic) => {
    onSelectNode(fav.associatedNodeId);
    
    const existingSession = sessions.find(s => s.history.some(t => t.id === fav.id));
    if (existingSession) {
      setActiveSessionId(existingSession.id);
      setV2FocusedThreadId(fav.id);
    } else {
      const restoredSessionId = `restored-session-${fav.id}`;
      const existingRestoredObj = sessions.find(s => s.id === restoredSessionId);
      if (!existingRestoredObj) {
        const newSessionObj: V2Session = {
          id: restoredSessionId,
          topicTitle: fav.title,
          history: fav.history
        };
        setSessions(prev => [...prev, newSessionObj]);
      }
      setActiveSessionId(restoredSessionId);
      setV2FocusedThreadId(fav.id);
    }
  };

  // Outside click listener to dismiss the dropdown menu
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = () => {
      setIsDropdownOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isDropdownOpen]);

  // Synchronize favorites save
  useEffect(() => {
    localStorage.setItem(`doppelganger_v2_favorites_${activeProfileHandle}`, JSON.stringify(favorites));
  }, [favorites, activeProfileHandle]);

  // Load favorites when profile changes
  useEffect(() => {
    const saved = localStorage.getItem(`doppelganger_v2_favorites_${activeProfileHandle}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
          if (parsed.length > 0) {
            setHeaderMode('favorites');
          } else {
            setHeaderMode('topics');
          }
          return;
        }
      } catch (_) {}
    }
    setFavorites([]);
    setHeaderMode('topics');
  }, [activeProfileHandle]);

  const updateScrollMetrics = () => {
    const container = document.getElementById("v2-thread-overlay-container");
    if (!container) return;

    // ACTIVE FRAME POSITION LOCKING
    // When the first answer is rendered, freeze vertical position instantly at exactly 5px below the tab section line.
    if (v2Threads.length === 1) {
      container.scrollTop = 0;
    }

    const children = Array.from(container.children).filter(child => child.hasAttribute("data-thread-id")) as HTMLElement[];
    const totalTurns = children.length;
    const newMetrics: { [id: string]: { scale: number; opacity: number; blur: number } } = {};

    const activeThread = v2Threads.find(t => t.id === v2FocusedThreadId) || v2Threads[v2Threads.length - 1];

    // COLLAPSED STATE LOCK:
    // When an answer container is collapsed or minimized, the system must explicitly block any layout adjustments,
    // size recalculations, or vertical compression updates that would expose adjacent containers. Minimizing must never reveal more questions or answers.
    if (activeThread && activeThread.isMinimized) {
      const activeIdx = v2Threads.findIndex(t => t.id === activeThread.id);
      children.forEach((child, index) => {
        const threadId = child.getAttribute("data-thread-id");
        if (!threadId) return;
        if (index === activeIdx) {
          newMetrics[threadId] = { scale: 1, opacity: 1, blur: 0 };
        } else {
          newMetrics[threadId] = { scale: 0.82, opacity: 0, blur: 3 };
        }
      });
      setScrollMetrics(newMetrics);
      return;
    }

    // Mathematically calculate which turn is active based on uniform 550px step coordinates
    const HEIGHT_STEP = 550;
    const scrollIdx = Math.min(totalTurns - 1, Math.max(0, Math.round(container.scrollTop / HEIGHT_STEP)));

    // Ensure active index is aligned with the focused thread if specified, which guarantees instantaneous visibility
    // even during layout/offset updates and rendering delays.
    const focusIdx = v2FocusedThreadId ? v2Threads.findIndex(t => t.id === v2FocusedThreadId) : -1;
    let activeIdx = scrollIdx;
    if (focusIdx >= 0 && focusIdx < totalTurns) {
      const expectedScroll = focusIdx * HEIGHT_STEP;
      const isScrollIncomplete = Math.abs(container.scrollTop - expectedScroll) > 10;
      if (isScrollIncomplete) {
        activeIdx = focusIdx;
      }
    }

    // 2. Set strict parameters for each child: STRICT SINGLE PAIR ISOLATION
    // Only exactly one question and answer container turn can be visible inside the viewport frame at any given time.
    children.forEach((child, index) => {
      const threadId = child.getAttribute("data-thread-id");
      if (!threadId) return;

      // All preceding or succeeding turn containers must instantly drop their visibility (opacity: 0, display/visibility: hidden)
      if (index !== activeIdx) {
        newMetrics[threadId] = { scale: 0.82, opacity: 0, blur: 3 };
        return;
      }

      // If active current turn
      if (index === activeIdx) {
        const offsetPastAnchor = container.scrollTop - (index * HEIGHT_STEP);

        if (offsetPastAnchor > 0) {
          const factor = Math.min(offsetPastAnchor / 200, 1);

          const scaleValue = 1 - (factor * 0.18); // scale down progressively to min footprint size of 0.82
          const opacityValue = 1 - (factor * 0.65); // dim smoothly down to ambient 0.35
          const blurValue = factor * 3; // minimal depth blur up to 3px

          newMetrics[threadId] = { scale: scaleValue, opacity: opacityValue, blur: blurValue };
        } else {
          // Absolute newest active turn block: force crystal clear 100% legibility
          newMetrics[threadId] = { scale: 1, opacity: 1, blur: 0 };
        }
      }
    });

    setScrollMetrics(newMetrics);

    // Coordinate parent focused thread tracking on valid scroll offsets
    const currentActiveThread = v2Threads[activeIdx];
    if (currentActiveThread && currentActiveThread.id !== v2FocusedThreadId) {
      setV2FocusedThreadId(currentActiveThread.id);
    }
  };

  // Bind scroll dynamically
  useEffect(() => {
    const container = document.getElementById("v2-thread-overlay-container");
    if (!container) return;

    const handleScrollEvent = () => {
      updateScrollMetrics();
    };

    container.addEventListener("scroll", handleScrollEvent, { passive: true });
    
    // Initial run
    updateScrollMetrics();

    // Trigger updates twice in short intervals to capture layout shifting
    const timer = setTimeout(updateScrollMetrics, 100);
    const timer2 = setTimeout(updateScrollMetrics, 400);

    return () => {
      container.removeEventListener("scroll", handleScrollEvent);
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [v2Threads, activeSessionId]);

  // Save changes to sessions & active ID
  useEffect(() => {
    localStorage.setItem('doppelganger_v2_sessions_v2_shared', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('doppelganger_v2_active_session_id_v2_shared', activeSessionId);
  }, [activeSessionId]);

  // Synchronise sessions and handle auto-creation/activation of doppelganger tabs when activeProfileHandle changes
  useEffect(() => {
    if (bypassSessionSyncRef.current) {
      bypassSessionSyncRef.current = false;
      return;
    }
    if (!activeProfileHandle) return;
    const pName = activeProfileHandle === "@chris.adkins" ? "Chris Adkins" :
                  activeProfileHandle === "@alex.morgan" ? "Alex Morgan" :
                  activeProfileHandle === "@jordan.lee" ? "Jordan Lee" : "";
    if (!pName) return;

    // Check if a session already exists with this topicTitle (case-insensitive)
    let existingSession = sessions.find(s => s.topicTitle.toLowerCase() === pName.toLowerCase());

    if (existingSession) {
      if (activeSessionId !== existingSession.id) {
        setActiveSessionId(existingSession.id);
        setV2Threads(existingSession.history);
        if (existingSession.history.length > 0) {
          setV2FocusedThreadId(existingSession.history[existingSession.history.length - 1].id);
        } else {
          setV2FocusedThreadId(null);
        }
      }
    } else {
      // Create a brand new tab for this doppelganger!
      const newSessionId = `session-profile-${activeProfileHandle.replace("@", "").replace(".", "-")}-${Date.now()}`;
      const newSessionObj: V2Session = {
        id: newSessionId,
        topicTitle: pName,
        history: []
      };
      setSessions(prev => {
        if (prev.some(s => s.topicTitle.toLowerCase() === pName.toLowerCase())) return prev;
        return [...prev, newSessionObj];
      });
      setActiveSessionId(newSessionId);
      setV2Threads([]);
      setV2FocusedThreadId(null);
    }
  }, [activeProfileHandle]);

  // Two-way synchronization: when activeSessionId changes, populate parent threads
  useEffect(() => {
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (currentSession) {
      syncRef.current = true;
      setV2Threads(currentSession.history);
      if (currentSession.history.length > 0) {
        setV2FocusedThreadId(currentSession.history[currentSession.history.length - 1].id);
      } else {
        setV2FocusedThreadId(null);
      }
    }
  }, [activeSessionId]);

  // Two-way synchronization: when parent threads update, sync to active session history
  useEffect(() => {
    if (syncRef.current) {
      syncRef.current = false;
      return;
    }
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          let updatedTitle = s.topicTitle;
          if (v2Threads.length > 0) {
            updatedTitle = (!v2Threads[0].isQuerying && v2Threads[0].topicTitle) ? v2Threads[0].topicTitle : "";
          }
          return { ...s, topicTitle: updatedTitle, history: v2Threads };
        }
        return s;
      })
    );
  }, [v2Threads]);

  // Route and Session management helpers
  const switchActiveSessionRoute = (sessionId: string) => {
    setActiveSessionId(sessionId);
    onSelectNode(null);

    const targetSession = sessions.find(s => s.id === sessionId);
    if (targetSession) {
      const pName = targetSession.topicTitle.toLowerCase().trim();
      const ALL_HARDCODED_PROFILES = [
        { name: "Chris Adkins", handle: "@chris.adkins" },
        { name: "Alex Morgan", handle: "@alex.morgan" },
        { name: "Jordan Lee", handle: "@jordan.lee" },
      ];
      const matchProf = ALL_HARDCODED_PROFILES.find(p => p.name.toLowerCase() === pName);
      if (matchProf && onSwitchProfile) {
        onSwitchProfile(matchProf.handle);
      } else if (onSwitchProfile && ownerHandle && activeProfileHandle !== ownerHandle) {
        onSwitchProfile(ownerHandle);
      }
    }
  };

  const spawnNewConversationSession = () => {
    const newId = `session-${Date.now()}`;
    const newSessionObj: V2Session = {
      id: newId,
      topicTitle: "New Thread",
      history: []
    };
    setSessions(prev => [...prev, newSessionObj]);
    setActiveSessionId(newId);
    onSelectNode(null);
  };

  const clearAndResetCurrentSession = () => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            topicTitle: "New Thread",
            history: []
          };
        }
        return s;
      })
    );
    handleResetV2Thread();
    onSelectNode(null);
  };

  const closeSessionRoute = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    if (activeSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
      } else {
        const newId = `session-${Date.now()}`;
        const newSessionObj: V2Session = {
          id: newId,
          topicTitle: "New Thread",
          history: []
        };
        setSessions([newSessionObj]);
        setActiveSessionId(newId);
        onSelectNode(null);
        return;
      }
    }
    setSessions(updatedSessions);
    onSelectNode(null);
  };

  const scrollToActiveTurnFocus = () => {
    const scrollElement = document.getElementById("v2-thread-overlay-container");
    if (!scrollElement) return;

    if (v2Threads.length <= 1) {
      scrollElement.scrollTop = 0;
      updateScrollMetrics();
      return;
    }

    const activeId = activeThread?.id;
    if (activeId) {
      const activeEl = scrollElement.querySelector(`[data-thread-id="${activeId}"]`) as HTMLElement;
      if (activeEl) {
        scrollElement.scrollTop = activeEl.offsetTop - 10;
      }
    }
    updateScrollMetrics();

    // 2. BACKUP SHIFT STABILIZER (to catch any deferred browser rendering/re-flow intervals)
    setTimeout(() => {
      if (activeId) {
        const activeElSecond = scrollElement.querySelector(`[data-thread-id="${activeId}"]`) as HTMLElement;
        if (activeElSecond) {
          scrollElement.scrollTop = activeElSecond.offsetTop - 10;
        }
      }
      updateScrollMetrics();
    }, 50);
  };

  // Auto-scroll to end of threads on new queries and update layout
  useEffect(() => {
    if (v2Threads.length > 0) {
      scrollToActiveTurnFocus();
    }
  }, [v2Threads.length, v2Threads]);

  // Find currently active/focused thread
  const activeThread = useMemo(() => {
    if (!v2FocusedThreadId) {
      return v2Threads[v2Threads.length - 1] || null;
    }
    return v2Threads.find(t => t.id === v2FocusedThreadId) || v2Threads[v2Threads.length - 1] || null;
  }, [v2Threads, v2FocusedThreadId]);

  const isExplorationMode = useMemo(() => {
    if (v2Threads.length === 0) return false;
    const active = v2Threads[v2Threads.length - 1];
    if (!active) return false;
    const hasQuestion = !!active.question && active.question.trim().length > 0;
    const hasAnswerOrLoading = !!active.answer || active.isQuerying;
    const hasNodes = !!(graphState && graphState.activeNodes && graphState.activeNodes.length > 0);
    return hasQuestion && hasAnswerOrLoading && hasNodes;
  }, [v2Threads, graphState]);

  // Stabilize active thread referenced nodes as a primitive string to avoid D3 reset when minimizing/maximizing threads
  const activeThreadReferencedNodesStr = useMemo(() => {
    return JSON.stringify(activeThread?.referencedNodes || []);
  }, [activeThread?.id, activeThread?.referencedNodes]);

  // Automatically find and include the Top-Level Project (Level 1) node of the active project component
  const citedNodeIdsForCanvas = useMemo(() => {
    if (!activeThread || !activeThread.referencedNodes || activeThread.referencedNodes.length === 0) {
      return [];
    }

    const baseCited = [...activeThread.referencedNodes];
    const allActiveNodes = graphState?.activeNodes || [];
    const allEdges = graphState?.edges || [];

    // Check if there is already a Level 1 / Top-level Project node cited
    const hasLevel1Cited = baseCited.some(id => {
      const node = allActiveNodes.find(n => n.id === id);
      if (!node) return false;
      const lvl = node.level !== undefined ? node.level : (node.weight >= 2.5 ? 1 : (node.weight >= 1.5 ? 2 : 3));
      return lvl === 1;
    });

    if (hasLevel1Cited) {
      return baseCited;
    }

    // Otherwise, find the Top-level Project node connected to any of the cited nodes
    const visited = new Set<string>(baseCited);
    const queue = [...baseCited];
    let foundLevel1Id: string | null = null;

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = allActiveNodes.find(n => n.id === currId);
      if (currNode) {
        const lvl = currNode.level !== undefined ? currNode.level : (currNode.weight >= 2.5 ? 1 : (currNode.weight >= 1.5 ? 2 : 3));
        if (lvl === 1) {
          foundLevel1Id = currId;
          break;
        }
      }

      allEdges.forEach(edge => {
        const sId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
        const tId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

        if (sId === currId && !visited.has(tId)) {
          visited.add(tId);
          queue.push(tId);
        } else if (tId === currId && !visited.has(sId)) {
          visited.add(sId);
          queue.push(sId);
        }
      });
    }

    if (foundLevel1Id && !baseCited.includes(foundLevel1Id)) {
      baseCited.push(foundLevel1Id);
    }

    return baseCited;
  }, [activeThread?.id, activeThreadReferencedNodesStr, graphState?.activeNodes, graphState?.edges]);

  // Dynamic filter lists using strict source isolation and structural pruning
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!graphState?.activeNodes) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    // 1. Get all valid allowed nodes belonging strictly to the selected Doppelganger
    const allowedNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== activeProfileHandle) return false;

      const isIsolated = node.isIsolated === true || node.visibility_status === "isolated_passphrase";
      if (isIsolated) {
        const keyHash = (node.access_key_hash || node.accessKeyHash || "").toUpperCase().trim();
        return unlockedTokens.includes(keyHash);
      }
      return true;
    });

    const allowedNodeIds = new Set(allowedNodes.map(n => n.id));
    const allEdges = graphState.edges || [];

    // Filter down to nodes reachable via connected component from cited nodes, if cited mode is active
    let reachableNodeIds = allowedNodeIds;
    const citedList = activeThread?.referencedNodes || [];

    if (mapFilterMode === 'cited' && citedList.length > 0) {
      const visited = new Set<string>();
      const queue: string[] = [];

      // Initialize queue with cited nodes that exist in allowedNodes
      citedList.forEach(id => {
        if (allowedNodeIds.has(id)) {
          queue.push(id);
          visited.add(id);
        }
      });

      // BFS traversal to discover connected nodes
      while (queue.length > 0) {
        const currId = queue.shift()!;
        allEdges.forEach(edge => {
          const sId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
          const tId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
          
          if (sId === currId && allowedNodeIds.has(tId) && !visited.has(tId)) {
            visited.add(tId);
            queue.push(tId);
          } else if (tId === currId && allowedNodeIds.has(sId) && !visited.has(sId)) {
            visited.add(sId);
            queue.push(sId);
          }
        });
      }
      reachableNodeIds = visited;
    }

    // 2. Filter nodes and edges based on the reachable set
    const filteredAllowedNodes = allowedNodes.filter(n => reachableNodeIds.has(n.id));

    const validatedEdges = allEdges.filter(edge => {
      const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      return reachableNodeIds.has(sourceId) && reachableNodeIds.has(targetId);
    });

    // 3. Keep only nodes that have at least one connection (no orphans),
    // but ALWAYS keep cited nodes when in cited mode.
    const connectedNodeIds = new Set<string>();
    validatedEdges.forEach(edge => {
      const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      connectedNodeIds.add(sourceId);
      connectedNodeIds.add(targetId);
    });

    const finalNodes = filteredAllowedNodes.filter(node => {
      if (mapFilterMode === 'cited' && citedList.includes(node.id)) {
        return true;
      }
      return connectedNodeIds.has(node.id);
    });

    return { filteredNodes: finalNodes, filteredEdges: validatedEdges };
  }, [activeProfileHandle, graphState?.activeNodes, graphState?.edges, unlockedTokens, mapFilterMode, activeThreadReferencedNodesStr]);

  const getNodeLevel = (n: any): number => {
    if (n.level !== undefined) {
      if (typeof n.level === "number") {
        return n.level;
      }
      if (n.level && typeof n.level === "object" && typeof n.level.value === "number") {
        return n.level.value;
      }
    }
    return classifyNodeLevel(n.label || "", "");
  };

  const activeThreadId = activeThread?.id || null;
  const rawTopicTitle = activeThread?.topicTitle || "";
  const rawAnswerText = activeThread?.answer || "";
  const isQuerying = activeThread?.isQuerying || false;

  const [streamState, setStreamState] = useState<"loading" | "topic-streaming" | "answer-streaming" | "completed">("completed");
  const [displayedTopic, setDisplayedTopic] = useState("");
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [nodeRevealStage, setNodeRevealStage] = useState(3);

  const rawTopicRef = useRef(rawTopicTitle);
  const rawAnswerRef = useRef(rawAnswerText);
  const isQueryingRef = useRef(isQuerying);

  useEffect(() => {
    rawTopicRef.current = rawTopicTitle;
    rawAnswerRef.current = rawAnswerText;
    isQueryingRef.current = isQuerying;
  }, [rawTopicTitle, rawAnswerText, isQuerying]);

  const lastThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeThreadId && activeThreadId !== lastThreadIdRef.current) {
      lastThreadIdRef.current = activeThreadId;
      if (isQuerying) {
        setStreamState("loading");
        setDisplayedTopic("");
        setDisplayedAnswer("");
        if (v2Threads.length <= 1) {
          setNodeRevealStage(0);
        } else {
          setNodeRevealStage(3);
        }
      } else {
        setStreamState("completed");
        setDisplayedTopic(rawTopicTitle);
        setDisplayedAnswer(rawAnswerText);
        setNodeRevealStage(3);
      }
    }
  }, [activeThreadId, isQuerying, rawTopicTitle, rawAnswerText, v2Threads.length]);

  useEffect(() => {
    const isRateLimitError = !!rawAnswerText && (
      rawAnswerText.toLowerCase().includes("rate limit") || 
      rawAnswerText.toLowerCase().includes("quota") ||
      rawAnswerText.toLowerCase().includes("resource_exhausted") ||
      rawAnswerText.toLowerCase().includes("429") ||
      rawAnswerText.toLowerCase().includes("error during inference") ||
      rawAnswerText.toLowerCase().includes("grounding endpoint") ||
      rawAnswerText.toLowerCase().includes("failed to contact")
    );

    if (streamState === "loading") {
      if (isRateLimitError) {
        setStreamState("completed");
      } else if (rawTopicTitle) {
        setStreamState("topic-streaming");
      } else if (rawAnswerText && !rawAnswerText.startsWith("Searching notes")) {
        setStreamState("answer-streaming");
      } else if (!isQuerying) {
        setStreamState("completed");
      }
      return;
    }

    if (streamState === "topic-streaming") {
      const words = rawTopicTitle.split(" ");
      let currentWordIndex = 0;
      setDisplayedTopic("");

      const interval = setInterval(() => {
        currentWordIndex++;
        if (currentWordIndex > words.length) {
          clearInterval(interval);
          if (isRateLimitError) {
            setStreamState("completed");
          } else {
            setStreamState("answer-streaming");
          }
          if (v2Threads.length <= 1) {
            setNodeRevealStage(1);
          } else {
            setNodeRevealStage(3);
          }
        } else {
          setDisplayedTopic(words.slice(0, currentWordIndex).join(" "));
        }
      }, 70);

      return () => clearInterval(interval);
    }

    if (streamState === "answer-streaming") {
      if (isRateLimitError) {
        setStreamState("completed");
        return;
      }
      let revealedWordCount = 0;
      setDisplayedAnswer("");

      const interval = setInterval(() => {
        const fullText = rawAnswerRef.current || "";
        if (fullText.startsWith("Searching notes")) {
          return;
        }
        const words = fullText.split(" ");
        
        if (revealedWordCount < words.length) {
          revealedWordCount++;
          setDisplayedAnswer(words.slice(0, revealedWordCount).join(" "));
        } else {
          clearInterval(interval);
          setStreamState("completed");
        }
      }, 50);

      return () => clearInterval(interval);
    }

    if (streamState === "completed") {
      setDisplayedTopic(rawTopicTitle);
      setDisplayedAnswer(rawAnswerText);
      setNodeRevealStage(3);
    }
  }, [streamState, rawTopicTitle, activeThreadId, isQuerying, rawAnswerText]);

  useEffect(() => {
    if (nodeRevealStage === 1) {
      const t1 = setTimeout(() => {
        setNodeRevealStage(2);
      }, 450);
      return () => clearTimeout(t1);
    }
    if (nodeRevealStage === 2) {
      const t2 = setTimeout(() => {
        setNodeRevealStage(3);
      }, 450);
      return () => clearTimeout(t2);
    }
  }, [nodeRevealStage]);

  const visibleNodes = useMemo(() => {
    if (nodeRevealStage === 0) return [];
    return filteredNodes.filter(n => {
      const lvl = getNodeLevel(n);
      if (nodeRevealStage === 1) return lvl === 1;
      if (nodeRevealStage === 2) return lvl === 1 || lvl === 2;
      return true;
    });
  }, [filteredNodes, nodeRevealStage]);

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return filteredEdges.filter(edge => {
      const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
  }, [visibleNodes, filteredEdges]);

  // Collapse thread helper
  const collapseAllThreads = () => {
    setV2Threads(prev => prev.map(t => ({ ...t, isMinimized: true })));
  };

  // Toggle single thread minimized state
  const toggleThreadMinimized = (threadId: string) => {
    setV2Threads(prev => 
      prev.map(t => t.id === threadId ? { ...t, isMinimized: !t.isMinimized } : t)
    );
  };

  // Inspector Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphState.activeNodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphState.activeNodes]);

  const [panelDetails, setPanelDetails] = useState<{
    decText: string;
    created: string;
    notes: string;
    memories: string[];
    relatedWork: { id: string; label: string; summary: string }[];
    insights: string[];
  } | null>(null);

  useEffect(() => {
    // 1. Clear previously rendered details immediately on selection change
    setPanelDetails(null);

    if (!selectedNode) {
      return;
    }

    const getNoteDate = (source: string) => {
      if (!source) return "June 7, 2026";
      const norm = source.trim().toLowerCase();
      if (norm === "journal_v1") return "May 10, 2026";
      if (norm === "journal_v2") return "May 18, 2026";
      if (norm === "journal_v3") return "May 25, 2026";
      if (norm === "journal_v4") return "June 2, 2026";
      if (norm === "journal_entry") return "June 7, 2026";
      try {
        const parsed = new Date(source);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      } catch (e) {}
      return source;
    };

    // 2. Load the selected item's data (notes/memories)
    const allNotes = graphState?.notes || graphState?.memories || [];
    const ownNotes = allNotes.filter(
      (m: any) => m.node_id === selectedNode.id || m.nodeId === selectedNode.id
    );
    const primaryNotesText = ownNotes.map((m: any) => m.content).join("\n\n");

    // 3. Resolve direct/indirect relationships based on Level rules
    const allActiveNodes = graphState?.activeNodes || [];
    const edges = graphState?.edges || [];
    
    const getNodeLevelLocal = (n: any) => {
      if (n.level !== undefined) {
        if (typeof n.level === "number") return n.level;
        if (n.level && typeof n.level === "object" && typeof n.level.value === "number") return n.level.value;
      }
      return classifyNodeLevel(n.label, "");
    };

    const selLvl = getNodeLevelLocal(selectedNode);
    const selHandle = (selectedNode.doppelgangerHandle || (selectedNode as any).ownerHandle || activeProfileHandle || "").toLowerCase().trim();
    
    let relatedNodes: any[] = [];
    
    const checkAccess = (oppNode: any) => {
      const isIsolated = oppNode.isIsolated === true || oppNode.visibility_status === "isolated_passphrase";
      const keyHash = (oppNode.access_key_hash || oppNode.accessKeyHash || "").toUpperCase().trim();
      return !isIsolated || unlockedTokens.includes(keyHash);
    };

    if (selLvl === 3) {
      // Task: Related work is the connected Workstream (Level 2)
      relatedNodes = allActiveNodes.filter(n => {
        if (getNodeLevelLocal(n) !== 2) return false;
        return edges.some(e => 
          (e.source === selectedNode.id && e.target === n.id) || 
          (e.target === selectedNode.id && e.source === n.id)
        );
      });
    } else if (selLvl === 2) {
      // Workstream: Related work is the connected Project (Level 1)
      relatedNodes = allActiveNodes.filter(n => {
        if (getNodeLevelLocal(n) !== 1) return false;
        return edges.some(e => 
          (e.source === selectedNode.id && e.target === n.id) || 
          (e.target === selectedNode.id && e.source === n.id)
        );
      });
    } else if (selLvl === 1) {
      // Project:
      // Option A: Another doppelganger's project of the same or similar name
      const cleanSelLabel = stripLabelNumbering(selectedNode.label).toLowerCase().trim();
      const otherProjectsSameName = allActiveNodes.filter(n => {
        if (getNodeLevelLocal(n) !== 1) return false;
        if (n.id === selectedNode.id) return false;
        const h = (n.doppelgangerHandle || (n as any).ownerHandle || "").toLowerCase().trim();
        if (h === selHandle && h !== "") return false;
        const cleanNodeLabel = stripLabelNumbering(n.label).toLowerCase().trim();
        return cleanSelLabel === cleanNodeLabel || cleanSelLabel.includes(cleanNodeLabel) || cleanNodeLabel.includes(cleanSelLabel);
      });

      // Option B: Workstreams of another doppelganger connected to the current doppelganger's project or workstreams connected to this project
      const currentWorkstreams = allActiveNodes.filter(n => 
        getNodeLevelLocal(n) === 2 && 
        (n.doppelgangerHandle || (n as any).ownerHandle || "").toLowerCase().trim() === selHandle &&
        edges.some(e => 
          (e.source === selectedNode.id && e.target === n.id) || 
          (e.target === selectedNode.id && e.source === n.id)
        )
      );

      const otherConnectedWorkstreams = allActiveNodes.filter(n => {
        if (getNodeLevelLocal(n) !== 2) return false;
        const h = (n.doppelgangerHandle || (n as any).ownerHandle || "").toLowerCase().trim();
        if (h === selHandle && h !== "") return false;
        
        const connectedToProject = edges.some(e => 
          (e.source === selectedNode.id && e.target === n.id) || 
          (e.target === selectedNode.id && e.source === n.id)
        );
        if (connectedToProject) return true;
        
        const connectedToCurrentWorkstream = currentWorkstreams.some(cw => 
          edges.some(e => 
            (e.source === cw.id && e.target === n.id) || 
            (e.target === cw.id && e.source === n.id)
          )
        );
        return connectedToCurrentWorkstream;
      });

      // Combine and filter duplicates
      const combined = [...otherProjectsSameName, ...otherConnectedWorkstreams];
      const seenIds = new Set<string>();
      relatedNodes = combined.filter(n => {
        if (seenIds.has(n.id)) return false;
        seenIds.add(n.id);
        return true;
      });
    }

    let relatedItems: any[] = relatedNodes
      .filter(checkAccess)
      .map(oppNode => ({
        id: oppNode.id,
        label: oppNode.label,
        summary: oppNode.summary || oppNode.notes || ""
      }));

    // 4. Generate fresh insights from the selected item's content only.
    let insights: string[] = [];
    const contentText = `${selectedNode.label} ${selectedNode.summary} ${selectedNode.notes || ""} ${primaryNotesText}`.toLowerCase();
    
    // Do not generate insights for node-1.0 Mobile App Redesign
    if (selectedNode.id !== "node-1.0") {
      if (contentText.includes("friction") || contentText.includes("navigation")) {
        insights.push("Targeting consistency in visual pattern styling and navigation layouts to streamline user flows.");
      }
      if (contentText.includes("offline") || contentText.includes("sqlite") || contentText.includes("sync")) {
        insights.push("Requires local persistence auditing to secure caching capabilities and recover buffers.");
      }
      if (contentText.includes("timeline") || contentText.includes("milestone")) {
        insights.push("Milestone tracking is configured for bi-weekly check-ins leading to beta launch readiness.");
      }
      if (contentText.includes("procurement") || contentText.includes("vendor")) {
        insights.push("Onboarding external specialists requires due diligence on statement-of-work parameters.");
      }
      if (contentText.includes("typography") || contentText.includes("kinetic")) {
        insights.push("Investigating accessibility and emotional expressions via animated typography systems.");
      }
      
      if (insights.length === 0 && selectedNode.summary) {
        insights.push(`Prioritizing execution of milestones for ${selectedNode.label} to align with design standards.`);
      }
    }

    const createdDate = selectedNode.isShared
      ? "May 10, 2026"
      : getNoteDate(ownNotes[0]?.source_origin || "Journal_v1");

    const isShared = (selectedNode as any).isShared;
    const decText = isShared
      ? `${(selectedNode as any).relationshipSummary || ""}\n\nRelated Areas: ${(selectedNode as any).relatedAreas?.join(", ") || ""}`
      : (selectedNode.id === "node-1.0" ? "" : primaryNotesText);

    // 5. Render the panel
    setPanelDetails({
      decText,
      created: createdDate,
      notes: selectedNode.notes || "",
      memories: selectedNode.id === "node-1.0" ? [] : ownNotes.map((m: any) => m.content),
      relatedWork: relatedItems,
      insights
    });
  }, [selectedNode, graphState?.notes, graphState?.memories, graphState?.activeNodes, graphState?.edges, unlockedTokens]);

  const nodeNotes = useMemo(() => {
    return panelDetails?.memories || [];
  }, [panelDetails]);

  const connectionsCount = useMemo(() => {
    if (!selectedNode || !graphState?.edges) return 0;
    return graphState.edges.filter(
      (edge: any) => edge.source === selectedNode.id || edge.target === selectedNode.id
    ).length;
  }, [selectedNode, graphState?.edges]);

  // Background Canvas interaction controls
  const handleStartDragging = (positions: { [nodeId: string]: { x: number; y: number } }) => {
    setCurrentNodePositions(positions);
  };

  const handleNodeDragged = (positions: { [nodeId: string]: { x: number; y: number } }) => {
    setCurrentNodePositions(positions);
  };

  const populateV2Input = (text: string) => {
    setV2Input(text);
    setTimeout(() => {
      const inputEl = document.getElementById("v2-initial-search-input") as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollLeft = 0;
        // Move selection cursor to beginning or end, and reset horizontal scroll explicitly to keep start of text in view
        inputEl.setSelectionRange(0, 0);
        inputEl.scrollLeft = 0;
      }
    }, 50);
  };

  const isAnyThreadOpen = v2Threads.some(t => !t.isMinimized);
  
  const hasActiveTopics = sessions.some(session => {
    const isNewAndEmpty = session.topicTitle === "New Thread" && session.history.length === 0;
    return !isNewAndEmpty;
  }) || v2Threads.length > 0;
  
  const hasFavorites = favorites.length > 0;
  const showBookmarksBar = hasActiveTopics || hasFavorites || sessions.length > 1 || sessions.some(s => s.id === activeSessionId && s.id !== "session-1");

  return (
    <div className="flex-grow flex flex-col items-stretch justify-stretch relative h-[calc(100vh-140px)] overflow-hidden bg-[#0C0C0E]">
      
      {/* 2. STRUCTURAL DOM REFIT: THE CONTROL SEPARATOR HEADER (NOW INDEPENDENT TABS TOUCHING THE DIVIDER LINE) */}
      {showBookmarksBar && (
        <div className="z-25 w-full pointer-events-auto shrink-0 flex flex-col pt-6">
          <div className="w-full max-w-2.5xl mx-auto px-4 flex flex-col">
            <div className="thread-control-header flex flex-row justify-between items-center gap-4 w-full pb-0.5">
              {/* LEFT BLOCK: Session Dynamic Tabs Array */}
              <div className="header-left-group flex items-center gap-3 w-full relative">
                <div className="relative shrink-0 border-r border-[#27272A] pr-3 h-4 flex items-center z-45">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
                    className="text-[10px] font-mono tracking-widest text-[#2DD4BF] font-extrabold select-none hover:text-white transition flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 focus:outline-none"
                  >
                    <span>{headerMode === 'topics' ? "Topics" : "Favorites"}</span>
                    <ChevronDown className={`w-3 h-3 text-[#2DD4BF] transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-6 left-0 bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl z-50 py-1.5 min-w-[130px]">
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMode('topics');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-mono font-bold tracking-wider hover:bg-zinc-800 transition-colors duration-150 flex items-center justify-between ${
                          headerMode === 'topics' ? "text-[#2DD4BF] bg-zinc-800/35" : "text-zinc-400"
                        }`}
                      >
                        <span>Topics</span>
                        {headerMode === 'topics' && <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]"></span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMode('favorites');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-mono font-bold tracking-wider hover:bg-zinc-800 transition-colors duration-150 flex items-center justify-between ${
                          headerMode === 'favorites' ? "text-[#2DD4BF] bg-zinc-800/35" : "text-zinc-400"
                        }`}
                      >
                        <span>Favorites</span>
                        {headerMode === 'favorites' && <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]"></span>}
                      </button>
                    </div>
                  )}
                </div>
                <div className="session-tabs-deck flex items-end gap-1.5 select-none overflow-x-auto no-scrollbar">
                  {headerMode === 'topics' ? (
                    sessions
                      .filter(session => {
                        // Show tab if it has history OR if it is the currently active empty session (created by clicking +)
                        return (session.history && session.history.length > 0) || (session.id === activeSessionId);
                      })
                      .map(session => {
                        const isSelected = session.id === activeSessionId;
                        return (
                          <div
                            key={session.id}
                            className="group relative flex items-center"
                          >
                            <button
                              type="button"
                              onClick={() => switchActiveSessionRoute(session.id)}
                              className={`session-tab-item px-3.5 py-1.5 rounded-t-xl text-xs font-sans transition-all duration-200 cursor-pointer flex items-center gap-2 border-t border-x border-[#27272A]/80 ${
                                isSelected
                                  ? "bg-[#0C0C0E] text-[#2DD4BF] font-semibold"
                                  : "bg-[#141417]/40 text-zinc-500 hover:text-zinc-300 hover:bg-[#141417]/80"
                              }`}
                              style={{ marginBottom: "-1px" }}
                            >
                              <span className="truncate whitespace-nowrap max-w-[210px] sm:max-w-[320px] md:max-w-none">{toTitleCase(session.topicTitle)}</span>
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  closeSessionRoute(session.id);
                                }}
                                className="p-0.5 rounded hover:bg-zinc-800 hover:text-red-400 transition"
                                title="Close tab"
                              >
                                <X className="w-2.5 h-2.5" />
                              </span>
                            </button>
                          </div>
                        );
                      })
                  ) : (
                    favorites.length > 0 ? (
                      favorites.map(fav => {
                        const isSelected = activeSessionId === `restored-session-${fav.id}` || sessions.find(s => s.id === activeSessionId)?.history.some(t => t.id === fav.id);
                        return (
                          <div
                            key={fav.id}
                            className="group relative flex items-center"
                          >
                            <button
                              type="button"
                              onClick={() => handleFavoriteTabClick(fav)}
                              className={`session-tab-item px-3.5 py-1.5 rounded-t-xl text-xs font-sans transition-all duration-200 cursor-pointer flex items-center gap-2 border-t border-x border-[#27272A]/80 ${
                                isSelected
                                  ? "bg-[#0C0C0E] text-[#2DD4BF] font-semibold"
                                  : "bg-[#141417]/40 text-zinc-500 hover:text-zinc-300 hover:bg-[#141417]/40"
                              }`}
                              style={{ marginBottom: "-1px" }}
                            >
                              <span className="truncate whitespace-nowrap max-w-[210px] sm:max-w-[320px] md:max-w-none">
                                {toTitleCase(fav.title)}
                              </span>
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeFavorite(fav.id, fav.title);
                                }}
                                className="p-0.5 rounded hover:bg-zinc-800 hover:text-red-400 transition"
                                title="Remove from favorites"
                              >
                                <X className="w-2.5 h-2.5" />
                              </span>
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <TypewriterFadingText text="No favorite topics yet." />
                    )
                  )}

                  {/* Persistent "+" Append Button for launching fresh blank states - ONLY IN TOPICS MODE */}
                  {headerMode === 'topics' && (
                    <button
                      type="button"
                      onClick={spawnNewConversationSession}
                      className="create-session-trigger px-3 py-1.5 rounded-t-xl border-t border-x border-dashed border-[#27272A]/80 hover:border-zinc-700 bg-transparent text-zinc-500 hover:text-white transition cursor-pointer text-xs font-bold"
                      style={{ marginBottom: "-1px" }}
                      title="Spawn new thread session"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT BLOCK: Neutral Gray Reset Button */}
              <button
                type="button"
                onClick={clearAndResetCurrentSession}
                className="reset-thread-action mb-1 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 hover:text-white border border-zinc-700 hover:border-zinc-500 text-[10px] font-mono font-bold text-zinc-300 transition flex items-center gap-1.5 cursor-pointer shadow-md select-none active:scale-95 duration-150 shrink-0"
                title="Reset current thread session"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </button>
            </div>
          </div>

          {/* BOTTOM HORIZONTAL RULE: Solid Divider Line */}
          <hr 
            className="thread-separator-line w-full" 
            style={{ 
              borderStyle: "solid",
              borderTop: "1px solid rgba(255, 255, 255, 0.15)", 
              borderBottom: "none", 
              borderLeft: "none", 
              borderRight: "none", 
              height: "0px", 
              margin: "0px" 
            }} 
          />
        </div>
      )}

      {/* LOWER WORKSPACE AREA - Crops the background canvas below the tabs */}
      <div className="flex-grow w-full relative min-h-0 overflow-hidden">
        
        {/* BACKGROUND CANVAS - Fully visible and interactive when thread is open or minimized */}
        <div 
          id="canvas-container"
          className={`absolute inset-0 z-0 transition-transform duration-500 ease-in-out ${
            v2Threads.length > 0 
              ? "opacity-100 scale-100 pointer-events-auto blur-none block" 
              : "opacity-0 scale-95 pointer-events-none blur-xl invisible h-0 w-0 overflow-hidden"
          } ${isExplorationMode ? "exploration-mode" : ""} ${selectedNode ? "has-sidebar" : ""}`}
          onClick={() => {
            collapseAllThreads();
          }}
        >
          <div className="w-full h-full relative">
            <KnowledgeGraphCanvas
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              unlockedTokens={unlockedTokens}
              onSelectNode={(id) => {
                onSelectNode(id);
              }}
              activeViewId="v2-guided-canvas"
              nodePositions={currentNodePositions}
              onStartDragging={handleStartDragging}
              onNodeDragged={handleNodeDragged}
              activeDoppelgangerId={activeProfileHandle}
              workflowMode="v2"
              systemHasNodes={!!(graphState && graphState.activeNodes && graphState.activeNodes.length > 0)}
              citedNodeIds={citedNodeIdsForCanvas}
              activeView="visitor"
            />
          </div>
        </div>

        {/* STATE 1: Centered Landing Chat Window */}
        {v2Threads.length === 0 && (
          <div className="absolute inset-0 flex flex-col justify-center items-center p-6 z-10 min-h-0 bg-[#0C0C0E]">
            <div 
              className="w-full max-w-lg p-8 pt-10 rounded-3xl shadow-2xl flex flex-col items-center gap-6 relative"
              style={{
                background: "rgba(15, 23, 42, 0.90)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: "1px",
                borderStyle: "solid"
              }}
            >
              <div className="flex flex-col items-center w-full">
                <div className="w-[250px] h-[250px] rounded-[32px] flex items-center justify-center overflow-hidden shrink-0 mb-[10px]">
                  <video
                    src="/head-animation.mp4"
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-[30px] mix-blend-screen"
                    style={{
                      WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                      maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)"
                    }}
                  />
                </div>

                <div className="text-center flex flex-col items-center">
                  <h1 className="text-3xl font-extrabold text-[#2DD4BF] tracking-tight font-sans">What can I help with?</h1>
                </div>
              </div>

            <form onSubmit={wrappedHandleV2Submit} className="w-full relative flex items-center">
              {renderAutocompleteDropdown("v2-initial-search-input")}
              <input
                type="text"
                id="v2-initial-search-input"
                placeholder="Ask anything"
                autoComplete="off"
                value={v2Input}
                onChange={(e) => {
                  const val = e.target.value;
                  const start = e.target.selectionStart || 0;
                  setV2Input(val);
                  handleInputUpdate(val, start, "v2-initial-search-input");
                }}
                onKeyDown={(e) => handleKeyDown(e, "v2-initial-search-input")}
                onBlur={() => {
                  setTimeout(() => {
                    setAutocomplete(prev => ({ ...prev, isOpen: false }));
                  }, 200);
                }}
                className="w-full h-12 pl-5 pr-12 rounded-xl text-sm sm:text-[15px] text-white placeholder:text-zinc-500 placeholder:text-sm sm:placeholder:text-[15px] focus:outline-none transition duration-150 shadow-inner block"
                style={{
                  background: "rgba(15, 23, 42, 0.90)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)"
                }}
              />
              <button
                type="submit"
                disabled={!v2Input.trim()}
                className="absolute right-2.5 h-7 w-7 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-zinc-950 flex items-center justify-center transition cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="w-full pt-4 min-w-0 border-t border-[#27272A]/40 flex flex-col gap-2.5 text-left font-sans">
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto text-center leading-relaxed">
                Access your team’s knowledge and expertise anytime.
              </p>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#2DD4BF] font-bold mt-2">Suggested Questions</div>
              <div id="suggested-queries-container" className="flex flex-col gap-1.5 w-full">
                {[
                  "Show all notes for the Mobile App Redesign project",
                  "What is the timeline for the Kinetic Type Prototype V2 study?",
                  activeProfileHandle === "@chris.adkins"
                    ? "What are the Design Sprints Planning dependencies I manage?"
                    : activeProfileHandle === "@jordan.lee"
                    ? "What are all of the Design Sprints Planning tasks?"
                    : "Show me all Design Sprints Planning dependencies managed by Chris Adkins"
                ].map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => populateV2Input(s)}
                    className="w-full text-left text-zinc-400 hover:text-[#2DD4BF] text-xs hover:bg-zinc-900/50 py-2.5 px-3.5 rounded-xl border border-zinc-850 hover:border-[#2DD4BF]/20 transition flex items-center gap-3 cursor-pointer group"
                  >
                    <span className="text-[#2DD4BF] group-hover:scale-105 transition duration-150 shrink-0">⚡</span>
                    <span className="truncate leading-tight">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: Vertical Thread Workspace */}
      {v2Threads.length > 0 && (
        <div 
          id="v2-thread-overlay-container"
          className={`scrollable-message-stack no-scrollbar ${isExplorationMode ? "exploration-mode" : ""}`}
          style={{
            overflowY: "auto"
          }}
        >
          {v2Threads.map((thread, index) => {
            const isCurrentlyFocused = activeThread?.id === thread.id;
            const isStreamingActive = isCurrentlyFocused && (streamState === "topic-streaming" || streamState === "answer-streaming");
            const currentTopic = isStreamingActive 
              ? (displayedTopic ? toTitleCase(displayedTopic) : "")
              : (thread.topicTitle ? toTitleCase(thread.topicTitle) : "");
            const currentAnswer = isStreamingActive ? displayedAnswer : thread.answer;
            const isRateLimitError = !!thread.answer && (
              thread.answer.toLowerCase().includes("rate limit") || 
              thread.answer.toLowerCase().includes("quota") ||
              thread.answer.toLowerCase().includes("resource_exhausted") ||
              thread.answer.toLowerCase().includes("429") ||
              thread.answer.toLowerCase().includes("error during inference") ||
              thread.answer.toLowerCase().includes("grounding endpoint") ||
              thread.answer.toLowerCase().includes("failed to contact")
            );
            const hasAnswerContent = !!currentAnswer && currentAnswer !== "Searching notes and generating response...";
            const isLoadingState = (isCurrentlyFocused ? (streamState === "loading") : thread.isQuerying) && 
                                   !hasAnswerContent && 
                                   !isRateLimitError && 
                                   (!thread.progressPercent || thread.progressPercent < 95);
            const metrics = scrollMetrics[thread.id];
            
            // ANTI-BLANKING: Force active or newest thread to have immediate visibility block and clear state
            const isActiveOrNewest = (index === v2Threads.length - 1) || isCurrentlyFocused;
            const itemScale = metrics?.scale ?? (isActiveOrNewest ? 1 : 0.82);
            const itemOpacity = metrics?.opacity ?? (isActiveOrNewest ? 1 : 0);
            const itemBlur = metrics?.blur ?? (isActiveOrNewest ? 0 : 3);

            const pHandle = thread.ownerHandle || activeProfileHandle || "@chris.adkins";
            const prof = getProfileInfo(pHandle);
            const photoUrl = PROFILE_IMAGES[prof.handle] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

            const uniqueContributorHandles = new Set<string>();
            uniqueContributorHandles.add(pHandle);
            if (thread.referencedNodes && thread.referencedNodes.length > 0) {
              thread.referencedNodes.forEach(nodeId => {
                const nd = graphState.activeNodes.find(n => n.id === nodeId);
                if (nd && nd.doppelgangerHandle) {
                  uniqueContributorHandles.add(nd.doppelgangerHandle);
                }
              });
            }
            const contributorHandles = Array.from(uniqueContributorHandles);

            return (
              <div 
                key={thread.id} 
                data-thread-id={thread.id}
                onClick={() => {
                  setV2FocusedThreadId(thread.id);
                }}
                className={`thread-turn-container group flex flex-col items-center gap-0 pointer-events-auto origin-bottom !overflow-visible cursor-pointer ${isCurrentlyFocused ? "is-focused" : ""}`}
                style={{
                  position: "absolute",
                  top: "5px",
                  left: "24px",
                  right: "24px",
                  width: "calc(100% - 48px)",
                  transform: `scale(${isCurrentlyFocused ? 1 : 0.82})`,
                  opacity: isCurrentlyFocused ? 1 : 0,
                  display: isCurrentlyFocused ? "flex" : "none",
                  visibility: isCurrentlyFocused ? "visible" : "hidden",
                  filter: "none",
                  transition: "transform 0.2s ease, filter 0.2s ease",
                  overflow: "visible"
                }}
              >
                {/* 1. ASK QUESTION CARD */}
                <div 
                  onClick={() => !isExplorationMode && toggleThreadMinimized(thread.id)}
                  className="v2-ask-question-card w-full max-w-xl p-6 rounded-2xl text-white text-sm sm:text-[15px] font-sans flex flex-col gap-2 shadow-sm pointer-events-auto relative !overflow-visible"
                  style={{ 
                    zIndex: 5,
                    boxShadow: isExplorationMode ? "none" : "0 6px 12px -3px rgba(0, 0, 0, 0.3), 0 2px 6px -2px rgba(0, 0, 0, 0.2)",
                    background: isExplorationMode ? "transparent" : "rgba(15, 23, 42, 0.90)",
                    backdropFilter: isExplorationMode ? "none" : "blur(16px)",
                    WebkitBackdropFilter: isExplorationMode ? "none" : "blur(16px)",
                    borderColor: isExplorationMode ? "transparent" : "rgba(255, 255, 255, 0.12)",
                    borderWidth: isExplorationMode ? "0px" : "1px",
                    borderStyle: "solid",
                    cursor: isExplorationMode ? "default" : "pointer"
                  }}
                >
                  <div className="flex items-center justify-between gap-3.5 w-full">
                    <div className="flex-1 min-w-0 font-semibold text-zinc-100 text-left">
                      {thread.question}
                    </div>
                    {!isExplorationMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleThreadMinimized(thread.id);
                        }}
                        className="w-8 h-8 rounded-lg bg-[#0c0c0e] hover:bg-zinc-800 border border-zinc-800 text-teal-400 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0"
                        title={thread.isMinimized ? "Expand answer" : "Collapse answer"}
                      >
                        {thread.isMinimized ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 self-start">
                    {thread.timestamp}
                  </span>
                  <div className="h-2" />
                </div>

                {/* 2. THE HARDWARE-ACCELERATED CLIPPING CONTAINER (VIEWPORT) */}
                <div 
                  className="v2-answer-animation-viewport w-full flex flex-col items-center !overflow-visible relative"
                  style={{
                    marginTop: "0px", // Perfectly flush with bottom of question card for the 0px offset clipping boundary
                    zIndex: 4,
                    clipPath: isExplorationMode ? "none" : "inset(0px -200px -200px -200px)",
                    WebkitClipPath: isExplorationMode ? "none" : "inset(0px -200px -200px -200px)"
                  }}
                >
                  {/* Upper spacer representing the 2px space between question card and vector path */}
                  <div className="w-full shrink-0 !overflow-visible" style={{ height: isExplorationMode ? "0px" : "2px" }} />

                  {/* Connection Path Container */}
                  <div 
                    className="flex flex-col items-center pointer-events-none transition-opacity duration-300 shrink-0 !overflow-visible"
                    style={{
                      opacity: (thread.isMinimized && !isExplorationMode) ? 0 : 1,
                      height: isExplorationMode ? "0px" : "6px",
                      display: isExplorationMode ? "none" : "flex"
                    }}
                  >
                    <div className="w-0.5 h-1.5 bg-zinc-800"></div>
                  </div>

                  {/* Lower spacer representing the 2px space between connection path and answer card */}
                  <div className="w-full shrink-0 !overflow-visible" style={{ height: isExplorationMode ? "0px" : "2px" }} />

                  {/* 3. AI ANSWER CARD (Floating Glassmorphic) */}
                  <div 
                    onClick={() => {
                      if (isExplorationMode) return;
                      if (thread.isMinimized) {
                        toggleThreadMinimized(thread.id);
                      } else {
                        setV2FocusedThreadId(thread.id);
                      }
                    }}
                    className="v2-ai-answer-card w-full max-w-xl rounded-2xl cursor-pointer p-6 border shadow-2xl relative !overflow-visible"
                    style={{
                      boxShadow: isExplorationMode ? "none" : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                      transform: (thread.isMinimized && !isExplorationMode) ? "translateY(calc(-100% + 2px))" : "translateY(0)",
                      opacity: (thread.isMinimized && !isExplorationMode) ? 0.55 : 1,
                      pointerEvents: "auto", // Ensure the card's 6px sticking-out edge remains interactive and clickable
                      transition: "transform 0.38s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease",
                      willChange: "transform, height",
                      zIndex: 4,
                      cursor: isExplorationMode ? "default" : "pointer",
                      background: isExplorationMode ? "transparent" : "rgba(15, 23, 42, 0.90)",
                      backdropFilter: isExplorationMode ? "none" : "blur(16px)",
                      WebkitBackdropFilter: isExplorationMode ? "none" : "blur(16px)",
                      borderColor: isExplorationMode ? "transparent" : "rgba(255, 255, 255, 0.12)",
                      borderWidth: isExplorationMode ? "0px" : "1px",
                      borderStyle: "solid"
                    }}
                  >
                    {!isExplorationMode && thread.isMinimized && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleThreadMinimized(thread.id);
                        }}
                        className="absolute bottom-0 left-0 right-0 h-4 cursor-pointer z-50 rounded-b-2xl !pointer-events-auto"
                        style={{ pointerEvents: "auto !important" as any }}
                        title="Click to expand response"
                      />
                    )}
                    <div 
                      className="flex flex-col gap-3"
                      style={{ pointerEvents: thread.isMinimized ? "none" : "auto" }}
                    >
                      {currentTopic && (
                        <div className="flex items-start justify-between border-b border-[#27272A]/40 pb-2.5">
                          <div className="flex flex-col text-left min-w-0 font-sans">
                            <span className="text-[9px] uppercase font-mono tracking-widest text-[#2DD4BF] font-extrabold leading-none mb-1">
                              {index > 0 ? "Follow up question" : "DISCUSSION TOPIC"}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-zinc-100 break-words whitespace-normal leading-tight">
                              {currentTopic}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(thread);
                            }}
                            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition cursor-pointer flex items-center justify-center shrink-0 ml-2"
                            title={isFavorited(thread.id, currentTopic) ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all ${
                                isFavorited(thread.id, currentTopic) 
                                  ? "fill-amber-400 text-amber-400" 
                                  : "text-zinc-500 hover:text-amber-400"
                              }`} 
                            />
                          </button>
                        </div>
                      )}

                      {/* Answer text block */}
                      <div 
                        id={`thread-answer-text-${thread.id}`}
                        className="text-zinc-200 text-sm sm:text-[15px] font-sans leading-relaxed break-words space-y-2 mt-1 px-1 focus:outline-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent v2-answer-scroll"
                      >
                        {isLoadingState ? (
                          <QueryProgress percent={thread.progressPercent} phase={thread.progressPhase} />
                        ) : isRateLimitError ? (
                          <div className="text-zinc-200 text-sm font-sans w-full text-left">
                            <div className="flex items-start gap-2.5">
                              <span className="text-lg leading-none select-none text-amber-500">⚠️</span>
                              <div>
                                <p className="font-bold text-zinc-100">AI Provider Rate Limits Reached</p>
                                <p className="mt-1 text-zinc-300 leading-relaxed text-xs">
                                  The current model has exceeded its API rate limit or free tier quota.
                                </p>
                                <p className="mt-2 text-zinc-300 leading-relaxed text-xs">
                                  To resolve this, open{" "}
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      onOpenSettings?.();
                                    }}
                                    className="underline hover:text-white font-bold cursor-pointer bg-transparent border-none p-0 inline-flex"
                                  >
                                    Settings
                                  </button>{" "}
                                  and try switching to a different **AI Provider** (such as <strong>LM Studio</strong> to run locally without limits) or try a lower-tier Gemini model (like <strong>gemini-3.1-flash-lite</strong> or <strong>gemini-2.5-flash-image</strong>).
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-line">{currentAnswer}</p>
                        )}
                      </div>

                      {/* Referenced Nodes Bar */}
                      {thread.referencedNodes && thread.referencedNodes.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25, duration: 0.35, ease: "easeOut" }}
                          className="mt-[18px] pt-[18px] border-t border-white/20 flex flex-col gap-1.5"
                        >
                          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-medium">
                            Cited Notes:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {thread.referencedNodes.map(nodeId => {
                              const nd = graphState.activeNodes.find(n => n.id === nodeId);
                              if (!nd) return null;
                              return (
                                <button
                                  key={nodeId}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectNode(nodeId);
                                  }}
                                  className={`px-2 py-1 rounded-md text-[10px] transition-all cursor-pointer border flex items-center gap-1 ${
                                    selectedNodeId === nodeId 
                                      ? "bg-zinc-800 border-zinc-600 text-zinc-100 font-medium"
                                      : "bg-zinc-950/80 hover:bg-zinc-900 border-zinc-850 text-zinc-400"
                                  }`}
                                >
                                  <Layers className="w-2.5 h-2.5" />
                                  <span>{formatNodeLabel(nd.label)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {/* Scaled-down doppelganger attribution block */}
                      <motion.div 
                        initial={{ opacity: 0, y: 6 }}
                        animate={!thread.isQuerying ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                        transition={{ delay: 0.5, duration: 0.35, ease: "easeOut" }}
                        className="mt-2 flex flex-col gap-1.5"
                      >
                        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-medium">
                          {contributorHandles.length > 1 ? "DOPPELGANGERS:" : "DOPPELGANGER:"}
                        </span>
                        <div className="flex flex-row flex-wrap gap-2">
                          {contributorHandles.map(handle => {
                            const contributorProf = getProfileInfo(handle);
                            const contrPhotoUrl = PROFILE_IMAGES[contributorProf.handle] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
                            
                            return (
                              <div key={handle} className="flex items-center gap-2 bg-[#0c0c0e]/40 py-1 px-2.5 rounded-lg border border-zinc-850 select-none">
                                <img 
                                  src={contrPhotoUrl} 
                                  alt={contributorProf.name}
                                  className="w-5 h-5 rounded object-cover border border-zinc-600 bg-zinc-950 cursor-pointer hover:ring-1 hover:ring-[#2DD4BF]/50 transition duration-150"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDoppelgangerClickFromCard(contributorProf.handle);
                                  }}
                                />
                                <div className="flex flex-col text-left font-sans">
                                  <span 
                                    className="text-[10px] font-semibold text-zinc-200 leading-none cursor-pointer hover:text-[#2DD4BF] hover:underline transition duration-150"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDoppelgangerClickFromCard(contributorProf.handle);
                                    }}
                                  >
                                    {contributorProf.name}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>

                      {/* General notice message */}
                      {thread.routingTrigger && (
                        <div className="mt-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-500/80 leading-normal flex items-start gap-1.5 font-sans">
                          <span className="mt-0.5">⚠️</span>
                          <span>
                            <strong>Notice:</strong> This query is answered using general team context. Output is proxied internally.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dynamic Scrollable Runway to support seamless history navigation offsets and preserve canvas spacing */}
          <div style={{ height: "650px", pointerEvents: "none" }} />
        </div>
      )}

      {/* FIXED BOTTOM REFINEMENT INPUT FIELD with contextually relevant Suggestion placeholder */}
      {v2Threads.length > 0 && (
        <div className={`v2-input-dock-panel ${isExplorationMode ? "exploration-mode" : ""}`}>
          <div className="max-w-xl mx-auto relative flex items-center pointer-events-auto">
            <form 
              onSubmit={wrappedHandleV2Submit} 
              className="w-full relative flex items-center"
            >
              {renderAutocompleteDropdown("v2-bottom-refinement-input")}
              <input
                type="text"
                id="v2-bottom-refinement-input"
                placeholder="Ask a follow up question..."
                autoComplete="off"
                value={v2Input}
                onChange={(e) => {
                  const val = e.target.value;
                  const start = e.target.selectionStart || 0;
                  setV2Input(val);
                  handleInputUpdate(val, start, "v2-bottom-refinement-input");
                }}
                onKeyDown={(e) => handleKeyDown(e, "v2-bottom-refinement-input")}
                onBlur={() => {
                  setTimeout(() => {
                    setAutocomplete(prev => ({ ...prev, isOpen: false }));
                  }, 200);
                }}
                className="w-full h-11 pl-4 pr-12 rounded-xl text-sm sm:text-[15px] text-white placeholder:text-zinc-500 placeholder:text-sm sm:placeholder:text-[15px] focus:outline-none transition shadow-2xl"
                style={{
                  background: "rgba(15, 23, 42, 0.90)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)"
                }}
              />
              <button
                type="submit"
                disabled={!v2Input.trim()}
                className="absolute right-2 h-7 w-7 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-zinc-950 flex items-center justify-center transition cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RIGHT SIDE INSPECTOR PANEL - Slide open on Node click */}
      {selectedNode && (
        <div 
          className="shadow-2xl flex flex-col gap-5 overflow-y-auto"
          style={{ 
            width: "320px",
            height: "100%",
            right: 0,
            top: 0,
            position: "absolute",
            zIndex: 20,
            transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
            transform: selectedNode ? "translateX(0)" : "translateX(100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            background: "rgba(20, 20, 23, 0.95)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "24px"
          }}
        >
          {/* Absolute Close Button */}
          <button
            type="button"
            onClick={() => onSelectNode(null)}
            className="absolute top-6 right-6 p-1.5 rounded-lg bg-[#141417]/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer flex items-center justify-center shadow-md active:scale-95"
            style={{ zIndex: 30 }}
            title="Collapse and Close Panel"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Label */}
          <div className="space-y-1 pr-8">
            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">CONTEXT</div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight leading-snug">
              {formatNodeLabel(selectedNode.label)}
            </h2>
          </div>

          {/* Node Summary */}
          <div className="space-y-2 bg-[#141417]/50 p-4 rounded-xl border border-zinc-650 mt-4">
            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Summary</div>
            <div className="text-xs text-zinc-300 leading-relaxed font-sans">
              {selectedNode.summary}
            </div>
          </div>

          {/* Details Section (combined notes & details) */}
          <div className="space-y-2 bg-[#141417]/50 p-4 rounded-xl border border-zinc-650 mt-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Details</div>
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {selectedNode.notes && (
                <div className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap pb-2 border-b border-zinc-850">
                  {selectedNode.notes}
                </div>
              )}
              {panelDetails?.memories && panelDetails.memories.length > 0 && (
                <div className="space-y-2">
                  {panelDetails.memories.map((content: string, idx: number) => (
                    <div key={idx} className="text-xs text-[#A1A1AA] leading-relaxed font-sans whitespace-pre-wrap">
                      {content}
                    </div>
                  ))}
                </div>
              )}
              {!selectedNode.notes && (!panelDetails?.memories || panelDetails.memories.length === 0) && (
                <div className="text-xs text-zinc-500 italic">No additional details recorded.</div>
              )}
              {panelDetails?.insights && panelDetails.insights.length > 0 && (
                <div className="border-t border-zinc-850 pt-2 text-[11px] leading-relaxed">
                  <div className="text-[8px] font-bold text-[#2DD4BF] uppercase tracking-wider mb-1 font-mono">Derived Insights</div>
                  <ul className="list-disc list-inside text-zinc-400 space-y-0.5">
                    {panelDetails.insights.map((insight: string, idx: number) => (
                      <li key={idx} className="marker:text-[#2DD4BF]">{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Related Work Section */}
          {panelDetails?.relatedWork && panelDetails.relatedWork.length > 0 && (
            <div className="space-y-2 bg-[#141417]/50 p-4 rounded-xl border border-zinc-650 mt-1">
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">Related Work:</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {panelDetails.relatedWork.map((work: any) => (
                  <div key={work.id} className="bg-[#141417]/30 p-2.5 rounded-lg border border-zinc-800">
                    <div className="text-xs font-bold text-zinc-200">{work.label}</div>
                    {work.summary && <p className="text-[11px] text-zinc-400 mt-1">{work.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Node metadata info (Properties) */}
          <div className="space-y-2 mt-2">
            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">Properties:</div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 border border-zinc-600 bg-[#141417] rounded-lg flex flex-col gap-0.5">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[8px]">Level</span>
                <span className="text-zinc-300 font-semibold">{(() => {
                  const lvl = selectedNode.level || (selectedNode.weight >= 2.5 ? 1 : (selectedNode.weight >= 1.5 ? 2 : 3));
                  return lvl === 1 ? "Project" : lvl === 2 ? "Workstream" : "Task";
                })()}</span>
              </div>
              <div className="p-2 border border-zinc-600 bg-[#141417] rounded-lg flex flex-col gap-0.5">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[8px]">Priority</span>
                <span className="text-[#2DD4BF] font-extrabold">{selectedNode.priority || 3}</span>
              </div>
              <div className="p-2 border border-zinc-600 bg-[#141417] rounded-lg flex flex-col gap-0.5">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[8px]">Visibility</span>
                <span className="text-zinc-300 uppercase">{selectedNode.visibility_status || "Public"}</span>
              </div>
              <div className="p-2 border border-zinc-600 bg-[#141417] rounded-lg flex flex-col gap-0.5">
                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[8px]">Connections</span>
                <span className="text-[#2DD4BF] font-extrabold">{connectionsCount}</span>
              </div>
            </div>
          </div>

          {/* Doppelganger Creator */}
          <div className="space-y-1.5 mt-4">
            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Doppelganger:</div>
            <div className="p-3.5 rounded-xl bg-[#141417] border border-zinc-600 flex items-center gap-3">
              {selectedNode.doppelgangerHandle && PROFILE_IMAGES[selectedNode.doppelgangerHandle] ? (
                <img
                  src={PROFILE_IMAGES[selectedNode.doppelgangerHandle]}
                  alt="Doppelganger Creator"
                  className="w-10 h-10 rounded-lg object-cover border border-zinc-600 bg-zinc-900 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#2DD4BF]/50 transition duration-150"
                  referrerPolicy="no-referrer"
                  onClick={() => onSwitchProfile && onSwitchProfile(selectedNode.doppelgangerHandle!)}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {(() => {
                  const creatorInfo = getProfileInfo(selectedNode.doppelgangerHandle || "", selectedNode.doppelganger);
                  const hNodes = graphState.activeNodes.filter(n => n.doppelgangerHandle === creatorInfo.handle);
                  const publicCount = hNodes.filter(n => n.node_state === "active" && !n.isIsolated && n.visibility_status !== "isolated_passphrase").length;
                  const privateCount = hNodes.filter(n => n.node_state === "active" && (n.isIsolated === true || n.visibility_status === "isolated_passphrase")).length;
                  return (
                    <>
                      <div 
                        className="text-xs font-semibold text-zinc-100 truncate cursor-pointer hover:text-[#2DD4BF] transition duration-150"
                        onClick={() => onSwitchProfile && onSwitchProfile(creatorInfo.handle)}
                      >
                        {creatorInfo.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate select-none">
                        {creatorInfo.title}
                      </div>
                      <div className="text-[10px] font-mono text-teal-400 select-none">
                        {creatorInfo.handle}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2 select-none border-t border-zinc-800/60 pt-1">
                        <span>Public Notes: <strong className="text-zinc-300 font-bold">{publicCount}</strong></span>
                        <span className="text-zinc-700">|</span>
                        <span className="flex items-center gap-0.5">Private Notes: <strong className="text-zinc-300 font-bold">{privateCount}</strong></span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>
      )}

      </div>
    </div>
  );
}

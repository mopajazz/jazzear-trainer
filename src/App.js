import { useState, useEffect, useRef, useCallback } from "react";

// --- Audio Engine ---
const AudioContext = window.AudioContext || window.webkitAudioContext;

function createNote(ctx, freq, startTime, duration, gainVal = 0.3) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
  gain.gain.setValueAtTime(gainVal, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// MIDI note to frequency
const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Chord definitions (MIDI notes)
const CHORDS = {
  Dm7: [62, 65, 69, 72], // D F A C
  G7alt: [67, 71, 73, 76, 77], // G B C# Eb F  (b9, #9, b13 flavors)
  Cmaj7: [60, 64, 67, 71], // C E G B
};

// Altered tension notes over G7
const TENSIONS = {
  "#9": { midi: 73, label: "#9 (A#/Bb)", color: "#f97316" },
  b9: { midi: 68, label: "b9 (Ab)", color: "#8b5cf6" },
  b13: { midi: 76, label: "b13 (Eb)", color: "#ec4899" },
  5: { midi: 74, label: "5 (D) — natural", color: "#22c55e" },
};

// 3rd vs 7th of a chord
const CHORD_TONES = {
  Dm7: {
    "3rd": { midi: 65, label: "F — Minor 3rd", color: "#f97316" },
    "7th": { midi: 72, label: "C — Minor 7th", color: "#8b5cf6" },
    root: { midi: 62, label: "D — Root", color: "#22c55e" },
    "5th": { midi: 69, label: "A — 5th", color: "#06b6d4" },
  },
  Cmaj7: {
    "3rd": { midi: 64, label: "E — Major 3rd", color: "#f97316" },
    "7th": { midi: 71, label: "B — Major 7th", color: "#8b5cf6" },
    root: { midi: 60, label: "C — Root", color: "#22c55e" },
    "5th": { midi: 67, label: "G — 5th", color: "#06b6d4" },
  },
};

const MODULES = [
  {
    id: "progression",
    title: "Hear the ii–V–I",
    emoji: "🎷",
    subtitle: "Train your ears on Dm7 → G7alt → Cmaj7",
    xp: 10,
    color: "#3b82f6",
  },
  {
    id: "chord_tones",
    title: "3rd vs 7th",
    emoji: "🎹",
    subtitle: "Identify chord tones by sound",
    xp: 15,
    color: "#8b5cf6",
  },
  {
    id: "tensions",
    title: "Spot the Alteration",
    emoji: "⚡",
    subtitle: "Hear #9, b9, b13 over V7alt",
    xp: 20,
    color: "#f97316",
  },
];

// --- Main App ---
export default function JazzEarTrainer() {
  const [screen, setScreen] = useState("home"); // home | drill | result
  const [module, setModule] = useState(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [bpm, setBpm] = useState(80);
  const audioCtxRef = useRef(null);

  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playChord = useCallback((midiNotes, delay = 0, duration = 1.2) => {
    const ctx = getCtx();
    const now = ctx.currentTime + delay;
    midiNotes.forEach((m, i) => {
      createNote(ctx, midiToFreq(m), now + i * 0.04, duration);
    });
  }, []);

  const playProgression = useCallback(() => {
    const ctx = getCtx();
    const beatDur = 60 / bpm;
    const beatsPerChord = 2;
    const dur = beatDur * beatsPerChord;
    const now = ctx.currentTime + 0.1;
    CHORDS.Dm7.forEach((m, i) =>
      createNote(ctx, midiToFreq(m), now + i * 0.05, dur)
    );
    CHORDS.G7alt.forEach((m, i) =>
      createNote(ctx, midiToFreq(m), now + dur + i * 0.05, dur)
    );
    CHORDS.Cmaj7.forEach((m, i) =>
      createNote(ctx, midiToFreq(m), now + dur * 2 + i * 0.05, dur)
    );
  }, [bpm]);

  const startModule = (mod) => {
    setModule(mod);
    setScreen("drill");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "white",
      }}
    >
      {screen === "home" && (
        <HomeScreen
          xp={xp}
          streak={streak}
          hearts={hearts}
          bpm={bpm}
          setBpm={setBpm}
          onStartModule={startModule}
          onPlayProgression={playProgression}
        />
      )}
      {screen === "drill" && module && (
        <DrillScreen
          module={module}
          bpm={bpm}
          hearts={hearts}
          setHearts={setHearts}
          onComplete={(gained) => {
            setXp((x) => x + gained);
            setStreak((s) => s + 1);
            setScreen("result");
          }}
          onExit={() => setScreen("home")}
          playChord={playChord}
          playProgression={playProgression}
          getCtx={getCtx}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          xp={xp}
          streak={streak}
          onContinue={() => setScreen("home")}
        />
      )}
    </div>
  );
}

// --- Home Screen ---
function HomeScreen({
  xp,
  streak,
  hearts,
  bpm,
  setBpm,
  onStartModule,
  onPlayProgression,
}) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}
          >
            🎺 JazzEar
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Daily Ear Training
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Pill emoji="🔥" value={streak} color="#f97316" />
          <Pill emoji="⚡" value={xp} label="XP" color="#eab308" />
          <Pill emoji="❤️" value={hearts} color="#ef4444" />
        </div>
      </div>

      {/* XP Progress Bar */}
      <div
        style={{
          background: "#1e293b",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#94a3b8",
            marginBottom: 8,
          }}
        >
          <span>Daily Goal</span>
          <span>{xp}/100 XP</span>
        </div>
        <div
          style={{
            background: "#334155",
            borderRadius: 99,
            height: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, xp)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
              borderRadius: 99,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Today's Drill — Progression */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #1e1b4b)",
          border: "1px solid #3b82f640",
          borderRadius: 18,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#93c5fd",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          TODAY'S PROGRESSION
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          {["Dm7", "→", "G7alt", "→", "Cmaj7"].map((c, i) => (
            <span
              key={i}
              style={{
                fontWeight: c === "→" ? 400 : 700,
                fontSize: c === "→" ? 18 : 16,
                color: c === "→" ? "#475569" : "#e2e8f0",
                background: c === "→" ? "transparent" : "#ffffff12",
                padding: c === "→" ? "0" : "4px 10px",
                borderRadius: 8,
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>BPM:</span>
            {[80, 100, 120].map((b) => (
              <button
                key={b}
                onClick={() => setBpm(b)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 600,
                  background: bpm === b ? "#3b82f6" : "#1e293b",
                  color: bpm === b ? "white" : "#94a3b8",
                  border: "1px solid " + (bpm === b ? "#3b82f6" : "#334155"),
                  cursor: "pointer",
                }}
              >
                {b}
              </button>
            ))}
          </div>
          <button
            onClick={onPlayProgression}
            style={{
              marginLeft: "auto",
              padding: "8px 18px",
              borderRadius: 99,
              background: "linear-gradient(90deg, #3b82f6, #6366f1)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            ▶ Play
          </button>
        </div>
      </div>

      {/* Modules */}
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          fontWeight: 600,
          marginBottom: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Drill Modules
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MODULES.map((mod, i) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            index={i}
            onClick={() => onStartModule(mod)}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 28,
          padding: "14px 18px",
          background: "#0f172a",
          borderRadius: 12,
          fontSize: 12,
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#64748b" }}>ii–V–I in C major</strong>
        <br />
        Dm7 = subdominant · G7alt = dominant with tensions · Cmaj7 = tonic
        resolution
      </div>
    </div>
  );
}

function Pill({ emoji, value, label, color }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "#1e293b",
        padding: "6px 10px",
        borderRadius: 99,
      }}
    >
      <span>{emoji}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color }}>
        {value}
        {label ? ` ${label}` : ""}
      </span>
    </div>
  );
}

function ModuleCard({ mod, index, onClick }) {
  const locked = index > 0 && false; // all unlocked for demo
  return (
    <button
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        border: `1px solid ${mod.color}40`,
        borderRadius: 16,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "transform 0.1s",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          fontSize: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${mod.color}22`,
          border: `2px solid ${mod.color}40`,
        }}
      >
        {mod.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>
          {mod.title}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {mod.subtitle}
        </div>
      </div>
      <div
        style={{
          background: `${mod.color}22`,
          color: mod.color,
          padding: "4px 10px",
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        +{mod.xp} XP
      </div>
    </button>
  );
}

// --- Drill Screen ---
const DRILL_QUESTIONS = {
  progression: [
    {
      prompt:
        "Listen to the progression. How does the G7alt chord feel compared to the Dm7?",
      options: [
        "Tense, wants to resolve",
        "Relaxed and stable",
        "Dark and minor",
        "Bright and major",
      ],
      correct: 0,
      explanation:
        "G7alt is a dominant chord loaded with altered tensions — it creates maximum tension that resolves to Cmaj7.",
    },
    {
      prompt: "Where does the ii–V–I feel like it 'lands'?",
      options: [
        "On the Dm7",
        "On the G7alt",
        "On the Cmaj7",
        "It never resolves",
      ],
      correct: 2,
      explanation:
        "The resolution or 'home' feeling lands on Cmaj7 — the tonic chord. This is the I chord.",
    },
    {
      prompt: "Which chord in Dm7–G7alt–Cmaj7 is the 'ii' chord?",
      options: ["G7alt", "Cmaj7", "Dm7", "None of them"],
      correct: 2,
      explanation:
        "Dm7 is the ii chord in C major. It's built on the 2nd degree (D) and has a minor 7th quality.",
    },
  ],
  chord_tones: [
    {
      prompt: "Over a Dm7 chord — which note is the minor 3rd?",
      playNote: { chord: "Dm7", tone: "3rd" },
      options: ["F", "A", "C", "D"],
      correct: 0,
      explanation:
        "F is a minor 3rd above D. It gives Dm7 its minor quality. The 3rd defines major vs minor!",
    },
    {
      prompt: "Over Cmaj7 — which note is the major 7th?",
      playNote: { chord: "Cmaj7", tone: "7th" },
      options: ["G", "E", "B", "A"],
      correct: 2,
      explanation:
        "B is the major 7th of C. It's a half-step below the root and gives Cmaj7 that dreamy, sophisticated sound.",
    },
    {
      prompt: "The 7th of a chord sounds like it wants to…",
      options: [
        "Stay put",
        "Move to the 3rd or root",
        "Jump up an octave",
        "Disappear",
      ],
      correct: 1,
      explanation:
        "Chord 7ths have strong tendencies — the 7th of G7 (F) wants to resolve down to the 3rd of Cmaj7 (E).",
    },
  ],
  tensions: [
    {
      prompt: "A #9 over G7alt sounds like…",
      options: [
        "A bluesy clash, almost angry",
        "A smooth, pretty note",
        "A strong root feeling",
        "Perfectly consonant",
      ],
      correct: 0,
      explanation:
        "#9 (A#/Bb over G) creates a classic jazz tension — it clashes with the major 3rd (B) for a bluesy, gritty sound.",
    },
    {
      prompt: "The b9 over G7alt creates what kind of feeling?",
      options: [
        "Peaceful resolution",
        "Dark, slightly menacing tension",
        "Happy and bright",
        "No particular feeling",
      ],
      correct: 1,
      explanation:
        "b9 (Ab over G) is a minor 2nd — one of the most dissonant intervals, creating dark, unsettled tension.",
    },
    {
      prompt: "Which alteration gives G7alt its most 'outside' sound?",
      options: ["b13 (Eb)", "Natural 5th (D)", "Natural 9th (A)", "Root (G)"],
      correct: 0,
      explanation:
        "b13 (Eb over G) is a tritone away from the natural 5th, creating maximum harmonic tension and distance from the key.",
    },
  ],
};

function DrillScreen({
  module,
  bpm,
  hearts,
  setHearts,
  onComplete,
  onExit,
  playChord,
  playProgression,
  getCtx,
}) {
  const questions = DRILL_QUESTIONS[module.id];
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [shakeWrong, setShakeWrong] = useState(false);

  const q = questions[qIndex];
  const progress = (qIndex / questions.length) * 100;

  const playCurrentNote = useCallback(() => {
    if (module.id === "progression") {
      playProgression();
    } else if (module.id === "chord_tones" && q.playNote) {
      const toneData = CHORD_TONES[q.playNote.chord][q.playNote.tone];
      const chordMidis = CHORDS[q.playNote.chord];
      const ctx = getCtx();
      const now = ctx.currentTime + 0.1;
      chordMidis.forEach((m, i) =>
        createNote(ctx, midiToFreq(m), now + i * 0.04, 1.5, 0.2)
      );
      createNote(ctx, midiToFreq(toneData.midi), now + 0.3, 2.0, 0.45);
    } else if (module.id === "tensions") {
      const tensionKeys = Object.keys(TENSIONS);
      const t = TENSIONS[tensionKeys[qIndex % tensionKeys.length]];
      const ctx = getCtx();
      const now = ctx.currentTime + 0.1;
      CHORDS.G7alt.forEach((m, i) =>
        createNote(ctx, midiToFreq(m), now + i * 0.04, 1.5, 0.2)
      );
      createNote(ctx, midiToFreq(t.midi), now + 0.3, 2.0, 0.45);
    }
  }, [module.id, q, qIndex, playProgression, getCtx]);

  const handleSelect = (idx) => {
    if (showFeedback) return;
    setSelected(idx);
    setShowFeedback(true);
    if (idx === q.correct) {
      setCorrectCount((c) => c + 1);
    } else {
      setShakeWrong(true);
      setHearts((h) => Math.max(0, h - 1));
      setTimeout(() => setShakeWrong(false), 500);
    }
  };

  const handleNext = () => {
    if (qIndex + 1 >= questions.length) {
      onComplete(
        (correctCount * module.xp) / questions.length +
          (correctCount === questions.length ? 5 : 0)
      );
    } else {
      setQIndex((i) => i + 1);
      setSelected(null);
      setShowFeedback(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <button
          onClick={onExit}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: 22,
            cursor: "pointer",
            padding: 4,
          }}
        >
          ✕
        </button>
        <div
          style={{
            flex: 1,
            background: "#1e293b",
            borderRadius: 99,
            height: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${module.color}, ${module.color}aa)`,
              borderRadius: 99,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <Pill emoji="❤️" value={hearts} color="#ef4444" />
      </div>

      {/* Module badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: `${module.color}22`,
          border: `1px solid ${module.color}44`,
          padding: "6px 14px",
          borderRadius: 99,
          marginBottom: 20,
        }}
      >
        <span>{module.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: module.color }}>
          {module.title}
        </span>
        <span style={{ fontSize: 12, color: "#475569" }}>
          · {qIndex + 1}/{questions.length}
        </span>
      </div>

      {/* Question */}
      <div
        style={{
          background: "#1e293b",
          borderRadius: 18,
          padding: 22,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.5,
            marginBottom: 18,
            color: "#f1f5f9",
          }}
        >
          {q.prompt}
        </div>

        {/* Play button */}
        <button
          onClick={playCurrentNote}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${module.color}33, ${module.color}11)`,
            border: `2px solid ${module.color}55`,
            color: module.color,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>🔊</span> Play Sound
        </button>
      </div>

      {/* Answer options */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {q.options.map((opt, i) => {
          let bg = "#1e293b",
            border = "#334155",
            color = "#e2e8f0";
          if (showFeedback) {
            if (i === q.correct) {
              bg = "#14532d";
              border = "#22c55e";
              color = "#86efac";
            } else if (i === selected && i !== q.correct) {
              bg = "#450a0a";
              border = "#ef4444";
              color = "#fca5a5";
            }
          } else if (selected === i) {
            bg = "#1e3a5f";
            border = module.color;
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                padding: "14px 18px",
                borderRadius: 14,
                background: bg,
                border: `2px solid ${border}`,
                color,
                fontWeight: 500,
                fontSize: 15,
                cursor: showFeedback ? "default" : "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                animation:
                  shakeWrong && i === selected && i !== q.correct
                    ? "shake 0.3s"
                    : "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "#ffffff12",
                  textAlign: "center",
                  lineHeight: "26px",
                  marginRight: 12,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {["A", "B", "C", "D"][i]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Feedback panel */}
      {showFeedback && (
        <div
          style={{
            background: selected === q.correct ? "#14532d44" : "#450a0a44",
            border: `1px solid ${
              selected === q.correct ? "#22c55e" : "#ef4444"
            }44`,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 6,
              color: selected === q.correct ? "#86efac" : "#fca5a5",
            }}
          >
            {selected === q.correct ? "✅ Correct!" : "❌ Not quite"}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            {q.explanation}
          </div>
        </div>
      )}

      {showFeedback && (
        <button
          onClick={handleNext}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 16,
            background: `linear-gradient(90deg, ${module.color}, ${module.color}cc)`,
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          {qIndex + 1 >= questions.length ? "Finish Lesson 🎉" : "Next →"}
        </button>
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// --- Result Screen ---
function ResultScreen({ xp, streak, onContinue }) {
  const [animXp, setAnimXp] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimXp(xp), 100);
    return () => clearTimeout(t);
  }, [xp]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "60px 24px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 80, marginBottom: 12 }}>🎷</div>
      <h2
        style={{
          fontSize: 30,
          fontWeight: 800,
          margin: "0 0 8px",
          background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Lesson Complete!
      </h2>
      <p style={{ color: "#64748b", marginBottom: 36 }}>
        Your ears are getting sharper
      </p>

      <div style={{ display: "flex", gap: 20, marginBottom: 40 }}>
        {[
          { emoji: "⚡", label: "Total XP", value: animXp, color: "#eab308" },
          { emoji: "🔥", label: "Streak", value: streak, color: "#f97316" },
          { emoji: "🎯", label: "Accuracy", value: "100%", color: "#22c55e" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#1e293b",
              borderRadius: 16,
              padding: "18px 20px",
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 28 }}>{stat.emoji}</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: stat.color,
                margin: "4px 0 2px",
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#1e293b",
          borderRadius: 16,
          padding: 18,
          width: "100%",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          XP PROGRESS
        </div>
        <div
          style={{
            background: "#334155",
            borderRadius: 99,
            height: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, animXp)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
              borderRadius: 99,
              transition: "width 1s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
          {animXp}/100 XP toward next level
        </div>
      </div>

      <button
        onClick={onContinue}
        style={{
          width: "100%",
          padding: 18,
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 17,
          background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)",
          color: "white",
          border: "none",
          cursor: "pointer",
          letterSpacing: 0.3,
        }}
      >
        Continue 🎶
      </button>
    </div>
  );
}

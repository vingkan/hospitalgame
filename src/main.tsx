import { StrictMode, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./reset.css";

const MarginGame = lazy(() => import("./margin/Game.tsx"));

const games = [
  {
    id: "margin",
    title: "The Margin Game",
    description:
      "Run a hospital over 5 years. Make strategic decisions about payer mix, staffing, service lines, and more — then see if you can keep the margin healthy.",
    accent: "#2dd4bf",
    icon: "\u{1F3E5}",
  },
];

function GameCard({
  game,
  onClick,
}: {
  game: (typeof games)[0];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#111827",
        border: "1px solid #1e293b",
        borderRadius: 16,
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        width: 300,
        overflow: "hidden",
        transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = game.accent;
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 8px 32px ${game.accent}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#1e293b";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          height: 120,
          background: `linear-gradient(135deg, ${game.accent}12, ${game.accent}06)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          borderBottom: `1px solid #1e293b`,
        }}
      >
        {game.icon}
      </div>
      <div style={{ padding: "20px 24px 24px" }}>
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 20,
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: 8,
          }}
        >
          {game.title}
        </div>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {game.description}
        </div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: game.accent,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Play
          <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
        </div>
      </div>
    </button>
  );
}

export function App() {
  const [game, setGame] = useState<string | null>(null);

  if (game === "margin") {
    return (
      <Suspense
        fallback={
          <div style={{ color: "#e2e8f0", padding: 40 }}>Loading...</div>
        }
      >
        <MarginGame onBack={() => setGame(null)} />
      </Suspense>
    );
  }

  return (
    <div
      style={{
        boxSizing: "border-box",
        height: "100vh",
        background: "#0a0f1a",
        color: "#e2e8f0",
        fontFamily: "'Manrope', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      {/* Subtle radial glow behind content */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", textAlign: "center" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: "#2dd4bf",
            marginBottom: 16,
          }}
        >
          Simulations
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 52,
            fontWeight: 700,
            marginBottom: 12,
            letterSpacing: -1,
          }}
        >
          Hospital Games
        </h1>
        <p
          style={{
            color: "#64748b",
            fontSize: 17,
            marginBottom: 56,
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          Interactive simulations that put you in the driver's seat of
          healthcare operations.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {games.map((g) => (
          <GameCard key={g.id} game={g} onClick={() => setGame(g.id)} />
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

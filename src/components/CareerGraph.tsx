// Decorative career-path graph: an ascending trajectory where each node is a
// proof-of-capability milestone leading toward opportunities.
const nodes = [
  { x: 60, y: 620, label: "Learn", kind: "self" },
  { x: 230, y: 560, label: "First project", kind: "evidence" },
  { x: 400, y: 590, label: "Evidence added", kind: "evidence" },
  { x: 560, y: 470, label: "Peer feedback", kind: "evidence" },
  { x: 720, y: 400, label: "Reviewed", kind: "reviewed" },
  { x: 880, y: 300, label: "Prototype demo", kind: "reviewed" },
  { x: 1040, y: 250, label: "Collaboration", kind: "reviewed" },
  { x: 1200, y: 140, label: "Opportunity", kind: "opportunity" },
] as const;

const branches = [
  { from: 4, x: 820, y: 520, label: "Mentorship" },
  { from: 5, x: 1000, y: 420, label: "Freelance gig" },
  { from: 6, x: 1180, y: 330, label: "Internship" },
  { from: 3, x: 640, y: 640, label: "New skill" },
];

export function CareerGraph() {
  const d = nodes.map((n, i) => {
    if (i === 0) return `M ${n.x} ${n.y}`;
    const p = nodes[i - 1]!;
    const cx = (p.x + n.x) / 2;
    return `C ${cx} ${p.y}, ${cx} ${n.y}, ${n.x} ${n.y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="cg-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--electric)" stopOpacity="0.15" />
          <stop offset="0.6" stopColor="var(--electric)" stopOpacity="0.8" />
          <stop offset="1" stopColor="var(--violet)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="cg-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--electric)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--electric)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cg-glow">
          <stop offset="0" stopColor="var(--electric)" stopOpacity="0.6" />
          <stop offset="1" stopColor="var(--electric)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* axis ticks */}
      {[160, 320, 480, 640].map((y) => (
        <line key={y} x1="0" x2="1280" y1={y} y2={y} stroke="var(--ink-foreground)" strokeOpacity="0.05" strokeDasharray="2 8" />
      ))}
      <text x="24" y="40" fill="var(--ink-muted)" fillOpacity="0.5" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="2">CAPABILITY ↑</text>
      <text x="1140" y="700" fill="var(--ink-muted)" fillOpacity="0.5" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="2">TIME →</text>

      <path d={`${d} L 1200 720 L 60 720 Z`} fill="url(#cg-area)" />

      {branches.map((b) => {
        const n = nodes[b.from]!;
        return (
          <g key={b.label} opacity="0.55">
            <path d={`M ${n.x} ${n.y} Q ${(n.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="var(--ink-foreground)" strokeOpacity="0.3" strokeDasharray="3 5" />
            <circle cx={b.x} cy={b.y} r="4" fill="none" stroke="var(--ink-foreground)" strokeOpacity="0.5" />
            <text x={b.x + 10} y={b.y + 4} fill="var(--ink-muted)" fontSize="11" fontFamily="var(--font-mono)">{b.label}</text>
          </g>
        );
      })}

      <path d={d} fill="none" stroke="url(#cg-line)" strokeWidth="2.5" className="career-line" />

      {nodes.map((n, i) => (
        <g key={n.label} opacity={0.35 + (i / nodes.length) * 0.65}>
          {(n.kind === "reviewed" || n.kind === "opportunity") && <circle cx={n.x} cy={n.y} r="26" fill="url(#cg-glow)" />}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.kind === "opportunity" ? 9 : 6}
            fill={n.kind === "self" ? "var(--ink)" : n.kind === "evidence" ? "var(--electric)" : n.kind === "reviewed" ? "var(--status-reviewed-bg)" : "var(--violet)"}
            stroke={n.kind === "self" ? "var(--ink-muted)" : "var(--ink-foreground)"}
            strokeWidth="1.5"
            strokeDasharray={n.kind === "self" ? "2 2" : undefined}
          />
          <text x={n.x} y={n.y - 18} textAnchor="middle" fill="var(--ink-foreground)" fillOpacity="0.7" fontSize="12" fontFamily="var(--font-mono)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

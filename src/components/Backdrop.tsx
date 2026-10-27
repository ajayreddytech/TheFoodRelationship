const LEAF = "M0 -60 C 34 -44 44 -4 0 60 C -44 -4 -34 -44 0 -60 Z M0 -50 L0 52";

/** Decorative wellness backdrop: soft glows, leaves, droplets and a lotus-style mandala. Colours follow the theme and palette. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.06] via-transparent to-accent/[0.07]" />
      <div className="bg-orb animate-float-slow absolute -left-24 -top-24 h-[28rem] w-[28rem] bg-brand/25" />
      <div className="bg-orb animate-float-slower absolute -right-32 top-1/3 h-[30rem] w-[30rem] bg-accent/20" />
      <div className="bg-orb animate-float-slow absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] bg-sky-400/15" />

      <svg className="absolute inset-0 h-full w-full text-brand" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor">
        <g className="animate-sway origin-center" style={{ transformOrigin: "1080px 130px" }} opacity="0.16" strokeWidth="2.2">
          <path d={LEAF} transform="translate(1080 130) rotate(28) scale(1.6)" />
          <path d={LEAF} transform="translate(1010 230) rotate(-18) scale(1.1)" />
          <path d={LEAF} transform="translate(1140 260) rotate(60) scale(0.9)" />
        </g>
        <g className="animate-sway-rev" style={{ transformOrigin: "110px 690px" }} opacity="0.16" strokeWidth="2.2">
          <path d={LEAF} transform="translate(110 690) rotate(-32) scale(1.7)" />
          <path d={LEAF} transform="translate(200 740) rotate(20) scale(1.1)" />
          <path d={LEAF} transform="translate(40 580) rotate(-70) scale(0.9)" />
        </g>
        <g opacity="0.1" strokeWidth="1.6" transform="translate(960 640)">
          {[40, 70, 100, 135, 175].map((r) => <circle key={r} r={r} />)}
          {Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 -40 C 14 -70 14 -110 0 -150 C -14 -110 -14 -70 0 -40 Z" transform={`rotate(${i * 30})`} />)}
        </g>
        <g opacity="0.14" fill="currentColor" stroke="none">
          {[[220, 150, 1], [520, 90, 0.7], [760, 220, 0.9], [330, 520, 0.8], [640, 700, 1.1], [880, 420, 0.7]].map(([x, y, s], i) => (
            <path key={i} className="animate-bob" style={{ animationDelay: `${i * 0.7}s` }} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -14 C 9 -2 11 4 11 8 A 11 11 0 0 1 -11 8 C -11 4 -9 -2 0 -14 Z" />
          ))}
        </g>
      </svg>
    </div>
  );
}

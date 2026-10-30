const P = 9; // 9x9 padas (Sakala)

function gridLines(step: number): { a: string; b: string }[] {
  const lines: { a: string; b: string }[] = [];
  for (let i = 0; i <= P; i++) {
    const v = i * step;
    lines.push({ a: `M ${v} 0 L ${v} 100`, b: `M 0 ${v} L 100 ${v}` });
  }
  return lines;
}

export default function VastuMandala() {
  const step = 100 / P;
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[min(46vh,480px)] w-[min(46vh,480px)] opacity-[0.06]"
      aria-hidden
    >
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="99"
        fill="#5e1b26"
        opacity="0.08"
      />
      {gridLines(step).map((l, i) => (
        <g key={i} stroke="#5e1b26" strokeWidth="0.35" fill="none">
          <path d={l.a} />
          <path d={l.b} />
        </g>
      ))}
      <g stroke="#5e1b26" strokeWidth="0.4" fill="none">
        <path d={`M 0 0 L 100 100`} />
        <path d={`M 100 0 L 0 100`} />
      </g>
      <rect
        x={3 * step}
        y={3 * step}
        width={3 * step}
        height={3 * step}
        fill="#b08d3e"
        opacity="0.22"
        stroke="#8f7024"
        strokeWidth="0.4"
      />
      <g stroke="#b08d3e" strokeWidth="0.6" fill="none">
        <path d={`M 0 6 L 6 0`} />
        <path d={`M 94 0 L 100 6`} />
        <path d={`M 0 94 L 6 100`} />
        <path d={`M 94 100 L 100 94`} />
      </g>
    </svg>
  );
}

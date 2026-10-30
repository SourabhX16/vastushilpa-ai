const TILE = 64;

export default function JaaliPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.13]" aria-hidden>
      <defs>
        <pattern
          id="jaali"
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke="#b08d3e"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          >
            <path d={`M0 0 L${TILE} ${TILE}`} />
            <path d={`M${TILE} 0 L0 ${TILE}`} />
            <circle cx={TILE / 2} cy={TILE / 2} r="9" />
            <circle cx="0" cy="0" r="11" />
            <circle cx={TILE} cy="0" r="11" />
            <circle cx="0" cy={TILE} r="11" />
            <circle cx={TILE} cy={TILE} r="11" />
          </g>
          <circle cx={TILE / 2} cy={TILE / 2} r="2" fill="#b08d3e" opacity="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#jaali)" />
    </svg>
  );
}

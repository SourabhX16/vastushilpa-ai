const TILE_W = 96;
const TILE_H = 40;
const ARCH_H = 30;
const CUSPS = 8;
const REPEAT = 12;

function cuspedArchPath(w: number, h: number, cusps: number): string {
  const tips: [number, number][] = [];
  for (let i = 0; i <= cusps; i++) {
    const t = Math.PI - (Math.PI * i) / cusps;
    tips.push([
      Number(((w / 2) * (1 + Math.cos(t))).toFixed(2)),
      Number((h * Math.sin(t)).toFixed(2)),
    ]);
  }
  let d = `M ${0} ${0}`;
  for (let i = 0; i < cusps; i++) {
    const [x1, y1] = tips[i];
    const [x2, y2] = tips[i + 1];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const cx = mx + (w / 2 - mx) * 0.12;
    const cy = my * 0.42;
    d += ` Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

const MAIN_D = cuspedArchPath(TILE_W, ARCH_H, CUSPS);

export default function ArchBand() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-14 flex h-10 border-t border-gold-500/40 lg:h-12"
    >
      {Array.from({ length: REPEAT }).map((_, i) => (
        <svg
          key={i}
          viewBox={`0 0 ${TILE_W} ${TILE_H}`}
          preserveAspectRatio="none"
          className="h-full flex-1"
        >
          <path
            d={MAIN_D}
            fill="hsl(20 54% 50% / 0.16)"
            stroke="hsl(42 42% 47% / 0.55)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={MAIN_D}
            fill="none"
            stroke="hsl(42 42% 47% / 0.35)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
            transform={`translate(${TILE_W / 2} 0) scale(0.8 0.78) translate(${-(TILE_W / 2)} 0)`}
          />
          <circle
            cx={TILE_W / 2}
            cy={ARCH_H + 4}
            r="1.6"
            fill="hsl(42 42% 47% / 0.5)"
          />
        </svg>
      ))}
    </div>
  );
}

const GRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.06" intercept="0"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`;

const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

export default function SandstoneGrain() {
  return (
    <div
      className="absolute inset-0 opacity-70 mix-blend-multiply"
      style={{ backgroundImage: GRAIN_URL }}
    />
  );
}

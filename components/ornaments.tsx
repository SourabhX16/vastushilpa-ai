export function WordmarkOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g fill="none" stroke="#b08d3e" strokeWidth="1.4">
        <path d="M20 2 L38 20 L20 38 L2 20 Z" />
        <path d="M20 9 L31 20 L20 31 L9 20 Z" opacity="0.7" />
      </g>
      <g fill="#5e1b26">
        <circle cx="20" cy="20" r="2.2" />
        <circle cx="20" cy="13" r="1.2" />
        <circle cx="27" cy="20" r="1.2" />
        <circle cx="20" cy="27" r="1.2" />
        <circle cx="13" cy="20" r="1.2" />
      </g>
      <g fill="#c4643b">
        <circle cx="20" cy="6" r="1.1" />
        <circle cx="34" cy="20" r="1.1" />
        <circle cx="20" cy="34" r="1.1" />
        <circle cx="6" cy="20" r="1.1" />
      </g>
    </svg>
  );
}

export function KiteDivider({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 10" className={className} aria-hidden>
      <g fill="none" stroke="#8f7024" strokeWidth="1">
        <path d="M0 5 L48 5" opacity="0.8" />
        <path d="M72 5 L120 5" opacity="0.8" />
        <path d="M60 1 L66 5 L60 9 L54 5 Z" />
        <path d="M44 3 L48 5 M76 5 L80 3" opacity="0.9" />
        <path d="M72 5 L76 7 M40 7 L44 5" opacity="0.5" />
      </g>
      <circle cx="60" cy="5" r="1.4" fill="#c4643b" />
    </svg>
  );
}

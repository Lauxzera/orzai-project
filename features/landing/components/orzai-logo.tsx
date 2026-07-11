export function OrzaiLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 36 A24 24 0 1 1 50.5 14.5" stroke="#2D7FEA" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M56 36 A20 20 0 1 1 47.5 18" stroke="#2D7FEA" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
      <circle cx="53" cy="13.5" r="5" fill="#00E5A0" />
      <circle cx="53" cy="13.5" r="2.5" fill="#0A0F1E" />
      <circle cx="53" cy="13.5" r="8" stroke="#00E5A0" strokeWidth="1" fill="none" opacity="0.3" />
      <circle cx="26" cy="28" r="2" fill="#2D7FEA" opacity="0.5" />
      <circle cx="36" cy="18" r="1.5" fill="#2D7FEA" opacity="0.35" />
    </svg>
  );
}

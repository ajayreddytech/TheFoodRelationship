/** Goal board: concentric target rings with an arrow stuck in the bullseye. Uses currentColor and lucide's stroke style. */
export function GoalBoardIcon({ size = 24, className }: { size?: string | number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="12" x2="20" y2="4" />
      <polyline points="15 4 20 4 20 9" />
    </svg>
  );
}

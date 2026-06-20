export function EmptyState({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="px-6 py-12 text-center">
      {icon && (
        <div className="flex justify-center mb-4 text-zinc-400">{icon}</div>
      )}
      <div className="text-lg font-bold text-zinc-900 mb-2">{title}</div>
      <p className="text-base text-zinc-600 leading-relaxed max-w-sm mx-auto">
        {body}
      </p>
    </div>
  );
}

const ICON_PROPS = {
  width: 48,
  height: 48,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const InboxIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export const BoxIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const TruckIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

export const ClipboardIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v3H9z" fill="currentColor" stroke="none" />
    <path d="M9 11h6M9 15h6" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

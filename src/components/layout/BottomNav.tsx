'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Map',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5">
        <polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
      </svg>
    ),
  },
  {
    href: '/stations',
    label: 'Stations',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5">
        <rect x="2" y="7" width="20" height="13" rx="2" />
        <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="8" y1="16" x2="16" y2="16" />
      </svg>
    ),
  },
  {
    href: '/passport',
    label: 'Passport',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 9h6M9 12h6M9 15h4" />
        <circle cx="6.5" cy="9" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="15" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Search',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: 'rgba(13,13,26,0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative pt-2"
            style={{ color: active ? 'var(--accent-red)' : 'var(--text-secondary)' }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent-red)' }}
              />
            )}
            {item.icon(active)}
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

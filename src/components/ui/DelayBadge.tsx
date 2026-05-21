interface DelayBadgeProps {
  minutes: number;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function DelayBadge({ minutes, size = 'md', showText = true }: DelayBadgeProps) {
  const isOnTime = minutes <= 0;
  const isMild = minutes > 0 && minutes < 30;
  const color = isOnTime
    ? 'var(--on-time)'
    : isMild
    ? 'var(--delayed-mild)'
    : 'var(--delayed-severe)';

  const label = isOnTime ? 'On time' : `${minutes} min late`;

  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '4px 12px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '14px' : '12px';

  if (!showText) {
    return (
      <span
        aria-label={label}
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
        }}
      />
    );
  }

  return (
    <span
      aria-label={`Delay status: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: color,
        color: '#fff',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: 9999,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function delayColor(minutes: number): [number, number, number] {
  if (minutes <= 0) return [34, 197, 94];   // green
  if (minutes < 30) return [234, 179, 8];   // yellow
  return [239, 68, 68];                      // red
}

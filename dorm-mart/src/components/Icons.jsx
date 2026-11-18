// Icons drawn on more than one page. Each takes the <svg>'s own props, so size
// and colour come from className as they did when the markup was inline.

function strokeIcon(...paths) {
  return function StrokeIcon(props) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
        {paths.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
    );
  };
}

export const CloseIcon = strokeIcon("M6 18L18 6M6 6l12 12");
export const ChevronDownIcon = strokeIcon("M19 9l-7 7-7-7");
export const InfoIcon = strokeIcon("M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z");
export const WarningIcon = strokeIcon(
  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
);
export const EyeIcon = strokeIcon(
  "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
);

const HeartOutline = strokeIcon(
  "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
);

export function HeartIcon({ filled = false, ...props }) {
  return <HeartOutline {...props} fill={filled ? "currentColor" : "none"} />;
}

export function ArrowRightIcon(props) {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" {...props}>
      <path
        fillRule="evenodd"
        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

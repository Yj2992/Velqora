import Link from "next/link";
export function Mark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r="14" stroke="currentColor" strokeWidth="1.4" />
      <ellipse
        cx="17"
        cy="17"
        rx="7"
        ry="14"
        stroke="currentColor"
        strokeWidth="1.4"
        transform="rotate(40 17 17)"
      />
      <circle cx="17" cy="17" r="4" fill="currentColor" />
    </svg>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo">
      <Mark />
      <span>
        DermaLens<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}

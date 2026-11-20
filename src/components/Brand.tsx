import { SITE } from "./site";

/**
 * The [/] mark, inlined so it follows the page's ink and scheme (see .brand in globals.css).
 * Source of record: brand/directions/b-root-bracket. Decorative unless `title` is given.
 */
export function BrandMark({
  className = "size-7",
  on,
}: {
  className?: string;
  /** "fg" when the mark sits on a tile filled with the ink colour. */
  on?: "fg";
}) {
  return (
    <svg
      viewBox="8 8 48 48"
      className={`brand ${className}`}
      data-on={on}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#d9f24e" d="M20.4 56H36.4L43.2 8H27.2Z" />
      <path
        fill="var(--brk)"
        d="M8 8H22V15H15V49H22V56H8Z M56 8H42V15H49V49H42V56H56Z"
      />
      <path fill="var(--slash)" d="M25.8 52H32.2L37.8 12H31.4Z" />
    </svg>
  );
}

/** Mark plus the wordmark in the page face (Clash Grotesk), for headers. */
export function BrandLogo({
  markClass = "size-7",
  textClass = "",
}: {
  markClass?: string;
  textClass?: string;
}) {
  return (
    <>
      <BrandMark className={`shrink-0 ${markClass}`} />
      <span className={textClass}>{SITE.name}</span>
    </>
  );
}

/** UNBLOCK logo: the neon "U" with a wheelchair on an accessible route (public/logo.png). */
export function UnblockMark({ size = 28, className }: { size?: number; className?: string }) {
  return <img src="/logo.png" width={size} height={size} alt="" aria-hidden className={className} style={{ display: 'block', borderRadius: size * 0.22 }} />;
}

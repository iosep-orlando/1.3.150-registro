/** El escudo del organismo si se cargó (desde el bucket), o un emblema genérico. */
export default function Escudo({ tiene, version, className = "h-10 w-10" }: { tiene: boolean; version: number; className?: string }) {
  if (tiene) {
    // eslint-disable-next-line @next/next/no-img-element -- viene del bucket por una URL prefirmada
    return <img src={`/api/config/escudo?v=${version}`} alt="" className={`${className} object-contain`} />;
  }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <path d="M20 3l14 5v10c0 9-6 16-14 19C12 34 6 27 6 18V8z" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13 19h14M20 12v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

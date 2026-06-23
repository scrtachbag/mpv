// Affichage visuel des bonus : `total` éclairs, dont `remaining` allumés.
export default function Bonus({ remaining, total = 2 }) {
  const left = Math.max(0, Math.min(total, remaining))
  return (
    <span className="bonus" title={`${left}/${total} bonus restants`} aria-label={`${left} sur ${total} bonus restants`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`bonus-dot${i < left ? ' on' : ''}`}>⚡</span>
      ))}
    </span>
  )
}

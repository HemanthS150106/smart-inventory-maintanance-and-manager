export default function Card({ children, className = '', staticSurface = false }) {
  return (
    <div
      className={`si-card ${staticSurface ? 'si-card--static' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

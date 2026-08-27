export function Alert({ error, ok }) {
  if (error) return <div className="alert alert-danger">{error}</div>
  if (ok) return <div className="alert alert-success">{ok}</div>
  return null
}

export function Pager({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null
  const start = Math.max(1, page - 5)
  const end = Math.min(totalPages, page + 5)
  const nums = []
  for (let i = start; i <= end; i += 1) nums.push(i)
  return (
    <nav>
      <ul className="pagination pagination-sm justify-content-center mt-3">
        {nums.map((n) => (
          <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
            <button type="button" className="page-link" onClick={() => onPage(n)}>
              {n}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function money(v) {
  const n = Number(v || 0)
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(n)
}

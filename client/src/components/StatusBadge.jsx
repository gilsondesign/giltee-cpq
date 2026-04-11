const STATUS_STYLES = {
  draft:      'bg-surface-container-highest text-on-surface-variant',
  processing: 'bg-secondary-fixed/30 text-secondary',
  ready:      'bg-secondary-fixed text-primary',
  error:      'bg-error-container text-on-error-container',
  sent:       'bg-primary text-on-primary',
  approved:   'bg-tertiary-container text-on-tertiary-container',
}

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-surface-container-highest text-on-surface-variant'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

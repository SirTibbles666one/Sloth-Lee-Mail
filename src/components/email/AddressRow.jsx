import { AddressChip } from './AddressChip'

export function AddressRow({ label, addrs, myEmail, onComposeTo }) {
  if (!addrs || addrs.length === 0) return null
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="text-xs text-foreground/45 w-9 shrink-0 pt-1 text-right uppercase tracking-wider">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {addrs.map((addr, i) => (
          <AddressChip key={i} addr={addr} myEmail={myEmail} onComposeTo={onComposeTo} />
        ))}
      </div>
    </div>
  )
}

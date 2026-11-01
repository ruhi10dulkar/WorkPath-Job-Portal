export default function ProfileField({ label, value = '', onChange, type = 'text', placeholder = '', disabled = false, readOnly = false, options, rows = 4, required = false, min, max }) {
  return <label className={`profile-field${type === 'textarea' ? ' profile-field-wide' : ''}`}>
    <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
    {type === 'textarea' ? <textarea value={value ?? ''} rows={rows} placeholder={placeholder} disabled={disabled} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /> : type === 'select' ? <select value={value ?? ''} disabled={disabled} onChange={(event) => onChange?.(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={type} value={type === 'date' ? String(value ?? '').slice(0, 10) : value ?? ''} placeholder={placeholder} disabled={disabled} readOnly={readOnly} required={required} min={min} max={max} onChange={(event) => onChange?.(event.target.value)} />}
  </label>
}

import { RATING_LABELS, RATING_VALUES, type EntryData, type EntryValue, type FormField, type FormSection } from "@shared/games/index";
import { Icon } from "./Icon";

// Inputs built for a phone held in one hand while watching a match:
// big targets, no keyboard unless there is no other way.

function Counter({ field, value, onChange }: { field: Extract<FormField, { type: "counter" }>; value: number; onChange: (v: number) => void }) {
  const steps = field.steps ?? [1];
  const max = field.max ?? 9999;
  const set = (next: number) => onChange(Math.max(0, Math.min(max, next)));
  return (
    <div className="counter">
      <button type="button" className="counter-btn" onClick={() => set(value - 1)} disabled={value <= 0} aria-label={`One less ${field.label}`}>
        <Icon name="minus" size={26} />
      </button>
      <output className="counter-value" aria-live="polite">
        {value}
      </output>
      {steps.map((step) => (
        <button key={step} type="button" className="counter-btn counter-add" onClick={() => set(value + step)} aria-label={`Add ${step} to ${field.label}`}>
          +{step}
        </button>
      ))}
    </div>
  );
}

function Segments({ options, value, onChange, label }: { options: Array<{ value: string; label: string }>; value: string | null; onChange: (v: string | null) => void; label: string }) {
  return (
    <div className="segments" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`segment${value === option.value ? " is-on" : ""}`}
          onClick={() => onChange(value === option.value ? null : option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange, readOnly }: { field: FormField; value: EntryValue | undefined; onChange: (v: EntryValue) => void; readOnly?: boolean }) {
  switch (field.type) {
    case "counter":
      return <Counter field={field} value={typeof value === "number" ? value : 0} onChange={onChange} />;
    case "toggle":
      return (
        <Segments
          label={field.label}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          value={value === true ? "yes" : value === false ? "no" : null}
          onChange={(v) => onChange(v === null ? null : v === "yes")}
        />
      );
    case "select":
      return <Segments label={field.label} options={field.options} value={typeof value === "string" ? value : null} onChange={onChange} />;
    case "rating":
      return (
        <Segments
          label={field.label}
          options={RATING_VALUES.map((v) => ({ value: v, label: RATING_LABELS[v] }))}
          value={typeof value === "string" ? value : null}
          onChange={onChange}
        />
      );
    case "multi": {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <div className="segments" role="group" aria-label={field.label}>
          {field.options.map((option) => {
            const on = chosen.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                className={`segment${on ? " is-on" : ""}`}
                onClick={() => onChange(on ? chosen.filter((v) => v !== option.value) : [...chosen, option.value])}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "number":
      return (
        <div className="number-input">
          <input
            type="number"
            inputMode="decimal"
            min={field.min ?? 0}
            max={field.max}
            value={typeof value === "number" ? value : ""}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            aria-label={field.label}
          />
          {field.unit ? <span>{field.unit}</span> : null}
        </div>
      );
    case "text":
      return field.long ? (
        <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={field.maxLength ?? 2000} aria-label={field.label} />
      ) : (
        <input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={field.maxLength ?? 200} aria-label={field.label} />
      );
  }
}

export function isMissing(field: FormField, value: EntryValue | undefined): boolean {
  if (!field.required) return false;
  return value === undefined || value === null || value === "";
}

export function EntryForm({ sections, data, onChange, showMissing }: { sections: FormSection[]; data: EntryData; onChange: (key: string, value: EntryValue) => void; showMissing?: boolean }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="panel form-section" id={`section-${section.id}`}>
          <h2>{section.label}</h2>
          {section.fields.map((field) => {
            const missing = showMissing && isMissing(field, data[field.key]);
            return (
              <div key={field.key} className={`form-field${missing ? " is-missing" : ""}`}>
                <div className="form-label">
                  {field.label}
                  {missing ? <span className="form-missing">Needed</span> : null}
                </div>
                {field.help ? <div className="field-help">{field.help}</div> : null}
                <FieldInput field={field} value={data[field.key]} onChange={(value) => onChange(field.key, value)} />
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

// A read-only rendering of an entry, for managers and strategists.
export function formatValue(field: FormField, value: EntryValue | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.type) {
    case "toggle":
      return value ? "Yes" : "No";
    case "select":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "multi":
      return Array.isArray(value) && value.length ? value.map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(", ") : "—";
    case "rating":
      return RATING_LABELS[value as keyof typeof RATING_LABELS] ?? String(value);
    case "number":
      return `${value}${field.unit ? ` ${field.unit}` : ""}`;
    default:
      return String(value);
  }
}

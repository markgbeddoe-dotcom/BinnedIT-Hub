import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

// ─── Palette context (makes dynamic colours accessible to all sub-components) ──
const C = createContext({});
function useC() { return useContext(C); }

// ─── Determine readable text colour on a given hex background ────────────────
function textOnHex(hex) {
  if (!hex || hex.length < 7) return '#000000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000006' : '#ffffff';
}

function makePalette(primaryColor) {
  const pc = primaryColor || '#EFDF0F';
  return {
    primary:      pc,
    primaryText:  textOnHex(pc),
    bg:           '#F2F6F4',
    white:        '#FFFFFF',
    border:       '#D1D9D4',
    borderFocus:  '#1A1A1A',
    text:         '#111827',
    textMuted:    '#6B7280',
    textLight:    '#9CA3AF',
    green:        '#059669',
    greenBg:      '#D1FAE5',
    red:          '#DC2626',
    redBg:        '#FEE2E2',
    black:        '#000006',
    card:         '#FFFFFF',
    shadow:       '0 1px 3px rgba(0,0,0,0.08)',
    shadowLg:     '0 4px 16px rgba(0,0,0,0.10)',
    headerBg:     '#000006',
  };
}

// ─── Fallback bin sizes (used when Supabase returns empty) ────────────────────
const FALLBACK_BINS = [
  { id: 'f-2m3', size_label: '2m³ Mini Skip',  volume_m3: 2, description: 'Perfect for small clean-ups, garage clear-outs or minor bathroom renos. Approx. 10–12 wheelie bins.',  price: 195, sort_order: 1, popular: true  },
  { id: 'f-4m3', size_label: '4m³ Small Skip', volume_m3: 4, description: 'Great for kitchen or bathroom renovations and medium household clean-ups. Approx. 30–35 wheelie bins.', price: 275, sort_order: 2, popular: false },
  { id: 'f-6m3', size_label: '6m³ Medium Skip', volume_m3: 6, description: 'Ideal for large renovations, landscaping projects or business clear-outs. Approx. 50–55 wheelie bins.',  price: 355, sort_order: 3, popular: false },
  { id: 'f-8m3', size_label: '8m³ Large Skip',  volume_m3: 8, description: 'Best for major construction, full property clear-outs or commercial jobs. Approx. 70–80 wheelie bins.',   price: 435, sort_order: 4, popular: false },
];

const WASTE_TYPES = [
  'General Household Waste',
  'Green Waste (Lawn, Branches, Leaves)',
  'Soil / Dirt / Sand',
  'Mixed Renovation Waste',
  'Concrete / Bricks / Pavers',
  'Timber / Wood',
  'Mixed Construction & Demolition',
];

const STEPS = ['Bin Size', 'Your Details', 'Delivery', 'Review & Confirm'];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
function minCollectionStr(deliveryDate) {
  if (!deliveryDate) return tomorrowStr();
  const d = new Date(deliveryDate);
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}
function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(step, data) {
  const e = {};
  if (step === 0) {
    if (!data.binId) e.binId = 'Please select a bin size to continue.';
  }
  if (step === 1) {
    if (!data.customerName?.trim())  e.customerName  = 'Full name is required.';
    if (!data.customerEmail?.trim()) e.customerEmail = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail.trim()))
      e.customerEmail = 'Please enter a valid email address.';
    if (!data.customerPhone?.trim()) e.customerPhone = 'Phone number is required.';
    else if (!/^(\+?61|0)[2-9]\d{8}$/.test(data.customerPhone.replace(/\s|-/g, '')))
      e.customerPhone = 'Please enter a valid Australian phone number.';
    if (!data.address?.trim())   e.address   = 'Delivery address is required.';
    if (!data.suburb?.trim())    e.suburb    = 'Suburb is required.';
    if (!data.postcode?.trim())  e.postcode  = 'Postcode is required.';
    else if (!/^\d{4}$/.test(data.postcode.trim())) e.postcode = 'Enter a valid 4-digit postcode.';
  }
  if (step === 2) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!data.deliveryDate) e.deliveryDate = 'Please select a delivery date.';
    else if (data.deliveryDate <= todayStr) e.deliveryDate = 'Delivery date must be at least tomorrow.';
    if (!data.collectionDate) e.collectionDate = 'Please select a collection date.';
    else if (data.deliveryDate && data.collectionDate <= data.deliveryDate)
      e.collectionDate = 'Collection must be at least one day after delivery.';
    if (!data.wasteType) e.wasteType = 'Please select a waste type.';
  }
  return e;
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function FieldError({ msg }) {
  const p = useC();
  if (!msg) return null;
  return <div style={{ color: p.red, fontSize: 12, marginTop: 4 }} role="alert">{msg}</div>;
}

function Label({ children, required }) {
  const p = useC();
  return (
    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: p.text, marginBottom: 6 }}>
      {children}{required && <span style={{ color: p.red, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function Input({ value, onChange, type = 'text', placeholder, hasError, autoComplete, inputMode, ...rest }) {
  const p = useC();
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '12px 14px', boxSizing: 'border-box',
        border: `1.5px solid ${hasError ? p.red : focused ? p.borderFocus : p.border}`,
        borderRadius: 8, fontSize: 16, fontFamily: '"DM Sans", system-ui, sans-serif',
        background: p.white, color: p.text, outline: 'none',
        transition: 'border-color 0.15s',
      }}
      {...rest}
    />
  );
}

function EmbedSelect({ value, onChange, children, hasError }) {
  const p = useC();
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '12px 14px', boxSizing: 'border-box',
        border: `1.5px solid ${hasError ? p.red : focused ? p.borderFocus : p.border}`,
        borderRadius: 8, fontSize: 16, fontFamily: '"DM Sans", system-ui, sans-serif',
        background: p.white, color: value ? p.text : p.textLight, outline: 'none',
        cursor: 'pointer', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
        paddingRight: 40,
      }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ onClick, disabled, loading, children }) {
  const p = useC();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '16px', borderRadius: 10, border: 'none',
        background: disabled || loading ? '#E5E7EB' : hovered ? p.borderFocus : p.primary,
        color: disabled || loading ? '#9CA3AF' : hovered ? (p.primaryText === '#000006' ? p.white : p.primaryText) : p.primaryText,
        fontSize: 16, fontWeight: 700, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        transition: 'background 0.15s, color 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading && (
        <span style={{
          width: 18, height: 18, border: `2px solid currentColor`, borderTopColor: 'transparent',
          borderRadius: '50%', display: 'inline-block', animation: 'embed-spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }) {
  const p = useC();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '14px', borderRadius: 10,
        border: `1.5px solid ${p.border}`,
        background: hovered ? '#F9FAFB' : p.white,
        color: p.textMuted, fontSize: 15, fontWeight: 600,
        cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const p = useC();
  return (
    <div style={{ background: p.headerBg, padding: '16px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done || active ? p.primary : 'transparent',
                  border: `2px solid ${done || active ? p.primary : '#555'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: done || active ? p.primaryText : '#888',
                  transition: 'all 0.2s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? p.primary : done ? '#aaa' : '#666',
                  marginTop: 4, textAlign: 'center',
                  display: typeof window !== 'undefined' && window.innerWidth < 480 && !active ? 'none' : 'block',
                }}>
                  {label}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 2, height: 2, background: i < step ? p.primary : '#333', margin: '0 4px', marginBottom: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Bin size selection ───────────────────────────────────────────────

function StepBinSize({ data, setData, errors, bins }) {
  const p = useC();
  return (
    <section aria-labelledby="embed-step1-heading">
      <h2 id="embed-step1-heading" style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 4 }}>
        Choose Your Bin Size
      </h2>
      <p style={{ fontSize: 14, color: p.textMuted, marginBottom: 24 }}>
        All prices include delivery, collection and standard waste disposal.
      </p>

      {errors.binId && (
        <div style={{ background: p.redBg, border: `1px solid ${p.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: p.red, fontSize: 14 }}>
          {errors.binId}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {bins.map(bin => {
          const selected = data.binId === bin.id;
          const sizes = { 0: 28, 1: 36, 2: 44, 3: 52 };
          const idx = bins.indexOf(bin);
          const sz = sizes[idx] || 44;
          return (
            <button
              key={bin.id}
              onClick={() => setData(d => ({ ...d, binId: bin.id, binLabel: bin.size_label, binPrice: bin.price }))}
              aria-pressed={selected}
              style={{
                background: selected ? `${p.primary}18` : p.card,
                border: `2px solid ${selected ? p.primary : p.border}`,
                borderRadius: 12, padding: '20px', cursor: 'pointer',
                textAlign: 'left', position: 'relative',
                boxShadow: selected ? `0 0 0 2px ${p.primary}` : p.shadow,
                transition: 'all 0.15s',
              }}
            >
              {bin.popular && (
                <div style={{
                  position: 'absolute', top: -1, right: 12,
                  background: p.primary, color: p.primaryText,
                  fontSize: 10, fontWeight: 700, padding: '2px 8px',
                  borderRadius: '0 0 6px 6px', letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: sz, height: sz,
                  background: selected ? p.primary : '#E5E7EB',
                  border: `2px solid ${selected ? p.borderFocus : '#9CA3AF'}`,
                  borderRadius: '3px 3px 6px 6px', position: 'relative', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: -3, left: 3, right: 3, height: 3,
                    background: selected ? p.borderFocus : '#9CA3AF', borderRadius: 2,
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: p.text, lineHeight: 1 }}>{bin.size_label}</div>
                  {bin.volume_m3 && (
                    <div style={{ fontSize: 12, color: p.textMuted, marginTop: 2 }}>{bin.volume_m3}m³ capacity</div>
                  )}
                </div>
              </div>

              {bin.description && (
                <p style={{ fontSize: 13, color: p.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{bin.description}</p>
              )}

              <div style={{
                fontSize: 22, fontWeight: 800, color: selected ? p.black : p.text,
                borderTop: `1px solid ${selected ? p.primary : p.border}`, paddingTop: 12,
              }}>
                ${bin.price}
                <span style={{ fontSize: 13, fontWeight: 400, color: p.textMuted }}> inc. GST</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Step 2: Customer details ─────────────────────────────────────────────────

function StepCustomerDetails({ data, setData, errors }) {
  const p = useC();
  const field = key => ({
    value: data[key],
    onChange: e => setData(d => ({ ...d, [key]: e.target.value })),
    hasError: !!errors[key],
  });

  return (
    <section aria-labelledby="embed-step2-heading">
      <h2 id="embed-step2-heading" style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 4 }}>
        Your Details
      </h2>
      <p style={{ fontSize: 14, color: p.textMuted, marginBottom: 24 }}>
        We&rsquo;ll use these to confirm your booking and arrange delivery.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Label required>Full Name</Label>
          <Input {...field('customerName')} placeholder="e.g. Jane Smith" autoComplete="name" />
          <FieldError msg={errors.customerName} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label required>Email Address</Label>
            <Input {...field('customerEmail')} type="email" placeholder="you@example.com" autoComplete="email" inputMode="email" />
            <FieldError msg={errors.customerEmail} />
          </div>
          <div>
            <Label required>Phone Number</Label>
            <Input {...field('customerPhone')} type="tel" placeholder="04XX XXX XXX" autoComplete="tel" inputMode="tel" />
            <FieldError msg={errors.customerPhone} />
          </div>
        </div>
        <div>
          <Label required>Delivery Address</Label>
          <Input {...field('address')} placeholder="Street number and name" autoComplete="street-address" />
          <FieldError msg={errors.address} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
          <div>
            <Label required>Suburb</Label>
            <Input {...field('suburb')} placeholder="e.g. Seaford" autoComplete="address-level2" />
            <FieldError msg={errors.suburb} />
          </div>
          <div style={{ width: 120 }}>
            <Label required>Postcode</Label>
            <Input {...field('postcode')} placeholder="3198" inputMode="numeric" autoComplete="postal-code" maxLength={4} />
            <FieldError msg={errors.postcode} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Step 3: Delivery details ─────────────────────────────────────────────────

function StepDeliveryDetails({ data, setData, errors }) {
  const p = useC();
  const field = key => ({
    value: data[key],
    onChange: e => setData(d => ({ ...d, [key]: e.target.value })),
    hasError: !!errors[key],
  });
  const [focusedTA, setFocusedTA] = useState(false);

  return (
    <section aria-labelledby="embed-step3-heading">
      <h2 id="embed-step3-heading" style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 4 }}>
        Delivery Details
      </h2>
      <p style={{ fontSize: 14, color: p.textMuted, marginBottom: 24 }}>
        We&rsquo;ll deliver on your chosen date and collect when you&rsquo;re done.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label required>Delivery Date</Label>
            <Input
              {...field('deliveryDate')} type="date"
              min={tomorrowStr()}
              onChange={e => setData(d => ({
                ...d,
                deliveryDate: e.target.value,
                collectionDate: d.collectionDate && d.collectionDate <= e.target.value ? '' : d.collectionDate,
              }))}
            />
            <FieldError msg={errors.deliveryDate} />
          </div>
          <div>
            <Label required>Collection Date</Label>
            <Input {...field('collectionDate')} type="date" min={minCollectionStr(data.deliveryDate)} />
            <FieldError msg={errors.collectionDate} />
          </div>
        </div>
        <div>
          <Label required>Type of Waste</Label>
          <EmbedSelect {...field('wasteType')}>
            <option value="">Select waste type…</option>
            {WASTE_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
          </EmbedSelect>
          <FieldError msg={errors.wasteType} />
        </div>
        <div>
          <Label>Special Instructions</Label>
          <textarea
            value={data.specialInstructions}
            onChange={e => setData(d => ({ ...d, specialInstructions: e.target.value }))}
            placeholder="Gate access code, placement instructions, anything we should know…"
            rows={3}
            onFocus={() => setFocusedTA(true)}
            onBlur={() => setFocusedTA(false)}
            style={{
              width: '100%', padding: '12px 14px', boxSizing: 'border-box',
              border: `1.5px solid ${focusedTA ? p.borderFocus : p.border}`,
              borderRadius: 8, fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif',
              background: p.white, color: p.text, outline: 'none', resize: 'vertical',
              minHeight: 80, transition: 'border-color 0.15s',
            }}
          />
          <div style={{ fontSize: 12, color: p.textLight, marginTop: 4 }}>Optional</div>
        </div>
        <div style={{ background: '#FFF8E1', border: '1px solid #F5E642', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#7A6500' }}>
          <strong>Prohibited items:</strong> Tyres, asbestos (separate service available), chemicals, paint, gas cylinders, medical waste. Contact us if unsure.
        </div>
      </div>
    </section>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function StepReview({ data, termsChecked, setTermsChecked, errors, tenant }) {
  const p = useC();
  const rows = [
    { label: 'Bin Size',         value: data.binLabel },
    { label: 'Delivery Address', value: `${data.address}, ${data.suburb} ${data.postcode}` },
    { label: 'Delivery Date',    value: formatDate(data.deliveryDate) },
    { label: 'Collection Date',  value: formatDate(data.collectionDate) },
    { label: 'Waste Type',       value: data.wasteType },
    { label: 'Name',             value: data.customerName },
    { label: 'Email',            value: data.customerEmail },
    { label: 'Phone',            value: data.customerPhone },
    ...(data.specialInstructions ? [{ label: 'Special Instructions', value: data.specialInstructions }] : []),
  ];
  const [cbHovered, setCbHovered] = useState(false);
  const hireDays = data.deliveryDate && data.collectionDate
    ? Math.round((new Date(data.collectionDate) - new Date(data.deliveryDate)) / 86400000)
    : null;

  const termsText = tenant?.terms_url
    ? <span>I agree to <a href={tenant.terms_url} target="_blank" rel="noopener noreferrer" style={{ color: p.primary, textDecoration: 'underline' }}>booking terms</a>.</span>
    : <span>I agree to {tenant?.company_name || 'the company'}&rsquo;s booking terms.</span>;

  return (
    <section aria-labelledby="embed-step4-heading">
      <h2 id="embed-step4-heading" style={{ fontSize: 22, fontWeight: 700, color: p.text, marginBottom: 4 }}>
        Review Your Booking
      </h2>
      <p style={{ fontSize: 14, color: p.textMuted, marginBottom: 24 }}>
        Please check everything looks correct before confirming.
      </p>

      <div style={{
        background: `${p.primary}18`, border: `2px solid ${p.primary}`, borderRadius: 12,
        padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Price</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: p.black, lineHeight: 1.1 }}>${data.binPrice}</div>
          <div style={{ fontSize: 12, color: p.textMuted, marginTop: 2 }}>Includes GST, delivery & collection</div>
        </div>
        {hireDays && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: p.textMuted }}>Hire period</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>{hireDays} {hireDays === 1 ? 'day' : 'days'}</div>
          </div>
        )}
      </div>

      <div style={{ background: p.card, border: `1px solid ${p.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, padding: '12px 16px',
            borderBottom: i < rows.length - 1 ? `1px solid ${p.border}` : 'none',
            background: i % 2 === 0 ? p.white : '#FAFAFA',
          }}>
            <div style={{ fontSize: 13, color: p.textMuted, fontWeight: 600, minWidth: 140, flexShrink: 0 }}>{r.label}</div>
            <div style={{ fontSize: 14, color: p.text, wordBreak: 'break-word' }}>{r.value}</div>
          </div>
        ))}
      </div>

      <label
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
          padding: '12px 14px',
          background: errors.terms ? p.redBg : cbHovered ? '#F9FAFB' : p.white,
          border: `1.5px solid ${errors.terms ? p.red : p.border}`,
          borderRadius: 8, transition: 'background 0.15s',
        }}
        onMouseEnter={() => setCbHovered(true)}
        onMouseLeave={() => setCbHovered(false)}
      >
        <input
          type="checkbox"
          checked={termsChecked}
          onChange={e => setTermsChecked(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, cursor: 'pointer', flexShrink: 0, accentColor: p.primary }}
        />
        <span style={{ fontSize: 13, color: p.text, lineHeight: 1.5 }}>
          {termsText}{' '}
          I confirm the delivery address is accessible for a skip bin truck and that I will not dispose of prohibited items.
          I understand that the hire period starts on the delivery date.
        </span>
      </label>
      <FieldError msg={errors.terms} />
    </section>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ bookingRef, data, tenant }) {
  const p = useC();
  return (
    <div style={{ background: p.bg, minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: p.greenBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 32, color: p.green,
        }}>
          ✓
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: p.text, marginBottom: 8 }}>Booking Confirmed!</h1>
        <p style={{ fontSize: 16, color: p.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
          Thanks for booking with {tenant?.company_name || 'us'}. We&rsquo;ll be in touch shortly to confirm your delivery.
        </p>

        {bookingRef && (
          <div style={{ background: `${p.primary}18`, border: `2px solid ${p.primary}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: p.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Booking Reference</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: p.black, letterSpacing: '0.08em' }}>#{bookingRef}</div>
          </div>
        )}

        <div style={{ background: p.card, border: `1px solid ${p.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: p.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>What happens next</div>
          {[
            { step: '1', text: "You'll receive a confirmation email shortly" },
            { step: '2', text: `Your ${data.binLabel || 'skip bin'} will be delivered on ${formatDate(data.deliveryDate)}` },
            { step: '3', text: 'Our driver will call 30 minutes before arrival' },
            { step: '4', text: "Fill your bin and we'll collect it on the agreed date" },
          ].map(({ step, text }) => (
            <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.primary, color: p.primaryText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step}</div>
              <div style={{ fontSize: 14, color: p.text, paddingTop: 3 }}>{text}</div>
            </div>
          ))}
        </div>

        {(tenant?.phone || tenant?.email) && (
          <div style={{ fontSize: 13, color: p.textMuted }}>
            Questions?{' '}
            {tenant.phone && <><a href={`tel:${tenant.phone.replace(/\s/g, '')}`} style={{ color: p.black, fontWeight: 700 }}>{tenant.phone}</a>{' '}</>}
            {tenant.email && <>or <a href={`mailto:${tenant.email}`} style={{ color: p.black, fontWeight: 700 }}>{tenant.email}</a></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading / error screens ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#6B7280', fontSize: 15 }}>
      Loading…
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🗑️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Widget Unavailable</h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{message || 'This booking widget could not be loaded. Please contact the website owner.'}</p>
      </div>
    </div>
  );
}

// ─── Main widget (rendered once tenant + bins are loaded) ─────────────────────

function EmbedWidget({ tenant, bins }) {
  const p = useC();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    binId: '', binLabel: '', binPrice: null,
    customerName: '', customerEmail: '', customerPhone: '',
    address: '', suburb: '', postcode: '',
    deliveryDate: '', collectionDate: '', wasteType: '', specialInstructions: '',
  });
  const [errors, setErrors] = useState({});
  const [termsChecked, setTermsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const goNext = useCallback(() => {
    const errs = validate(step, data);
    if (step === 3 && !termsChecked) errs.terms = 'Please accept the terms and conditions.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    if (step < 3) { setStep(s => s + 1); return; }

    setSubmitting(true);
    setSubmitError(null);
    (async () => {
      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .insert({
            customer_name:        data.customerName.trim(),
            customer_email:       data.customerEmail.trim().toLowerCase(),
            customer_phone:       data.customerPhone.trim(),
            address:              data.address.trim(),
            suburb:               data.suburb.trim(),
            postcode:             data.postcode.trim(),
            bin_size:             data.binLabel,
            waste_type:           data.wasteType,
            delivery_date:        data.deliveryDate,
            collection_date:      data.collectionDate,
            special_instructions: data.specialInstructions?.trim() || null,
            price:                data.binPrice,
            status:               'pending',
            tenant_id:            tenant?.id || null,
          })
          .select('id')
          .single();

        if (error) throw error;

        const ref = booking.id.slice(0, 8).toUpperCase();
        setBookingRef(ref);

        fetch('/api/book-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId:    booking.id,
            bookingRef:   ref,
            customerName: data.customerName.trim(),
            customerEmail: data.customerEmail.trim().toLowerCase(),
            binSize:      data.binLabel,
            deliveryDate: data.deliveryDate,
            price:        data.binPrice,
            suburb:       data.suburb.trim(),
          }),
        }).catch(() => {});

        setSubmitted(true);
      } catch (err) {
        setSubmitError(err.message || 'Something went wrong. Please try again or call us.');
      } finally {
        setSubmitting(false);
      }
    })();
  }, [step, data, termsChecked, tenant]);

  const goBack = () => { setErrors({}); setStep(s => s - 1); };

  if (submitted) {
    return <SuccessScreen bookingRef={bookingRef} data={data} tenant={tenant} />;
  }

  return (
    <div style={{ background: p.bg, minHeight: '100vh', fontFamily: '"DM Sans", system-ui, sans-serif', color: p.text }}>

      {/* Header */}
      <header style={{ background: p.headerBg, padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.company_name} style={{ height: 40, objectFit: 'contain' }} />
          ) : (
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: p.primary, letterSpacing: '0.03em', lineHeight: 1, textTransform: 'uppercase' }}>
                {tenant?.company_name || 'Book a Skip Bin'}
              </div>
              {tenant?.suburb && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Skip Bin Hire — {tenant.suburb}</div>
              )}
            </div>
          )}
          <div style={{ flex: 1 }} />
          {tenant?.phone && (
            <div style={{ textAlign: 'right' }}>
              <a href={`tel:${tenant.phone.replace(/\s/g, '')}`} style={{ color: p.primary, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                {tenant.phone}
              </a>
              <div style={{ fontSize: 11, color: '#888' }}>Mon–Sat 7am–5pm</div>
            </div>
          )}
        </div>
      </header>

      {/* Hero strip */}
      <div style={{ background: p.primary, padding: '10px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: p.primaryText, margin: 0 }}>
          Same-day &amp; next-day delivery available &mdash; Book before 10am
        </p>
      </div>

      <ProgressBar step={step} />

      <main style={{ maxWidth: 700, margin: '32px auto', padding: '0 16px 48px' }}>
        <div style={{ background: p.card, borderRadius: 16, boxShadow: p.shadowLg, padding: '32px 28px' }}>

          {step === 0 && <StepBinSize data={data} setData={setData} errors={errors} bins={bins} />}
          {step === 1 && <StepCustomerDetails data={data} setData={setData} errors={errors} />}
          {step === 2 && <StepDeliveryDetails data={data} setData={setData} errors={errors} />}
          {step === 3 && <StepReview data={data} termsChecked={termsChecked} setTermsChecked={setTermsChecked} errors={errors} tenant={tenant} />}

          {submitError && (
            <div style={{ background: p.redBg, border: `1px solid ${p.red}`, borderRadius: 8, padding: '12px 14px', marginTop: 16, color: p.red, fontSize: 14 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
            <PrimaryButton onClick={goNext} loading={submitting}>
              {step < 3 ? `Continue to ${STEPS[step + 1]}` : submitting ? 'Submitting…' : 'Confirm Booking'}
            </PrimaryButton>
            {step > 0 && <SecondaryButton onClick={goBack}>&larr; Back</SecondaryButton>}
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          {[
            { icon: '🔒', label: 'Secure Booking' },
            { icon: '🚛', label: 'On-time Delivery' },
            { icon: '♻️', label: 'Responsible Disposal' },
            { icon: '⭐', label: '5-Star Service' },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: p.textMuted }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: p.headerBg, color: '#888', padding: '20px 24px', textAlign: 'center', fontSize: 12 }}>
        <p style={{ margin: 0 }}>
          &copy; {new Date().getFullYear()} {tenant?.company_name || 'Skip Bin Hire'}
          {tenant?.suburb && ` — ${tenant.suburb}`}
          {tenant?.email && (
            <> &mdash; <a href={`mailto:${tenant.email}`} style={{ color: p.primary, textDecoration: 'none' }}>{tenant.email}</a></>
          )}
        </p>
      </footer>
    </div>
  );
}

// ─── Top-level loader ─────────────────────────────────────────────────────────

export default function EmbedBookingPage({ tenantSlug }) {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [bins, setBins] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!tenantSlug) {
      setLoadError('No booking widget slug provided.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Load tenant config
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', tenantSlug)
          .eq('active', true)
          .single();

        if (tenantErr || !tenantData) {
          setLoadError(`No active booking widget found for "${tenantSlug}".`);
          setLoading(false);
          return;
        }

        setTenant(tenantData);

        // Load bin sizes for this tenant
        const { data: binData } = await supabase
          .from('tenant_bin_sizes')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('sort_order', { ascending: true });

        setBins(binData?.length ? binData : FALLBACK_BINS);
      } catch (err) {
        // Supabase not available — use fallback data
        setTenant({
          id: null,
          slug: tenantSlug,
          company_name: 'Skip Bin Hire',
          primary_color: '#EFDF0F',
          secondary_color: '#000006',
        });
        setBins(FALLBACK_BINS);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantSlug]);

  const palette = makePalette(tenant?.primary_color);

  if (loading) {
    return (
      <C.Provider value={palette}>
        <LoadingScreen />
      </C.Provider>
    );
  }

  if (loadError) {
    return (
      <C.Provider value={palette}>
        <ErrorScreen message={loadError} />
      </C.Provider>
    );
  }

  return (
    <>
      <style>{`@keyframes embed-spin { to { transform: rotate(360deg); } }`}</style>
      <C.Provider value={palette}>
        <EmbedWidget tenant={tenant} bins={bins} />
      </C.Provider>
    </>
  );
}

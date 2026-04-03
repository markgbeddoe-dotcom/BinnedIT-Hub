import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── SkipSync booking brand colours (separate from internal dashboard) ───────
const SK = {
  yellow:      '#EFDF0F',
  yellowDark:  '#C8BC0A',
  yellowLight: '#FEFCE8',
  black:       '#000006',
  bg:          '#F2F6F4',
  white:       '#FFFFFF',
  border:      '#D1D9D4',
  borderFocus: '#000006',
  text:        '#111827',
  textMuted:   '#6B7280',
  textLight:   '#9CA3AF',
  green:       '#059669',
  greenBg:     '#D1FAE5',
  red:         '#DC2626',
  redBg:       '#FEE2E2',
  card:        '#FFFFFF',
  shadow:      '0 1px 3px rgba(0,0,0,0.08)',
  shadowLg:    '0 4px 16px rgba(0,0,0,0.10)',
};

// ─── Bin products ────────────────────────────────────────────────────────────
const BIN_SIZES = [
  {
    id: '2m3', label: '2m³ Mini Skip',
    desc: 'Perfect for small clean-ups, garage clear-outs or minor bathroom renos.',
    capacity: 'Approx. 10–12 wheelie bins',
    price: 195, popular: true,
  },
  {
    id: '4m3', label: '4m³ Small Skip',
    desc: 'Great for kitchen or bathroom renovations and medium household clean-ups.',
    capacity: 'Approx. 30–35 wheelie bins',
    price: 275, popular: false,
  },
  {
    id: '6m3', label: '6m³ Medium Skip',
    desc: 'Ideal for large renovations, landscaping projects or business clear-outs.',
    capacity: 'Approx. 50–55 wheelie bins',
    price: 355, popular: false,
  },
  {
    id: '8m3', label: '8m³ Large Skip',
    desc: 'Best for major construction, full property clear-outs or commercial jobs.',
    capacity: 'Approx. 70–80 wheelie bins',
    price: 435, popular: false,
  },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function validate(step, data) {
  const e = {};
  if (step === 0) {
    if (!data.binSize) e.binSize = 'Please select a bin size to continue.';
  }
  if (step === 1) {
    if (!data.customerName?.trim()) e.customerName = 'Full name is required.';
    if (!data.customerEmail?.trim()) e.customerEmail = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail.trim()))
      e.customerEmail = 'Please enter a valid email address.';
    if (!data.customerPhone?.trim()) e.customerPhone = 'Phone number is required.';
    else if (!/^(\+?61|0)[2-9]\d{8}$/.test(data.customerPhone.replace(/\s|-/g, '')))
      e.customerPhone = 'Please enter a valid Australian phone number.';
    if (!data.address?.trim()) e.address = 'Delivery address is required.';
    if (!data.suburb?.trim()) e.suburb = 'Suburb is required.';
    if (!data.postcode?.trim()) e.postcode = 'Postcode is required.';
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

// ─── SEO — inject meta tags and JSON-LD on mount, restore on unmount ─────────
function useSEO() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Book a Skip Bin Online | Binned-IT | Seaford, Melbourne';

    function setMeta(attr, attrVal, content) {
      let el = document.querySelector(`meta[${attr}="${attrVal}"]`);
      let created = false;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, attrVal); document.head.appendChild(el); created = true; }
      const prev = el.getAttribute('content');
      el.setAttribute('content', content);
      return { el, prev, created };
    }

    const metas = [
      setMeta('name', 'description', 'Book a skip bin online with Binned-IT — fast, affordable skip bin hire in Seaford, Melbourne. Choose 2m³ to 8m³. Same-day delivery available.'),
      setMeta('name', 'robots', 'index, follow'),
      setMeta('property', 'og:title', 'Book a Skip Bin | Binned-IT — Seaford, Melbourne'),
      setMeta('property', 'og:description', 'Easy online booking for skip bin hire in Melbourne\'s south-east. Transparent pricing from $195.'),
      setMeta('property', 'og:type', 'website'),
    ];

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Binned-IT Pty Ltd',
      description: 'Skip bin hire in Seaford, Melbourne. 2m³ to 8m³ bins for household and commercial waste.',
      url: 'https://binnedit-hub.vercel.app/book',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Seaford',
        addressLocality: 'Seaford',
        addressRegion: 'VIC',
        postalCode: '3198',
        addressCountry: 'AU',
      },
      priceRange: '$195–$435',
      areaServed: { '@type': 'State', name: 'Victoria' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Skip Bin Hire',
        itemListElement: BIN_SIZES.map(b => ({
          '@type': 'Offer',
          name: b.label,
          description: b.desc,
          price: b.price,
          priceCurrency: 'AUD',
        })),
      },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'booking-ld-json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      metas.forEach(({ el, prev, created }) => {
        if (created) el.parentNode?.removeChild(el);
        else el.setAttribute('content', prev ?? '');
      });
      document.getElementById('booking-ld-json')?.remove();
    };
  }, []);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  return (
    <div style={{ background: SK.black, padding: '16px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done ? SK.yellow : active ? SK.yellow : 'transparent',
                  border: `2px solid ${done || active ? SK.yellow : '#555'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: done || active ? SK.black : '#888',
                  transition: 'all 0.2s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? SK.yellow : done ? '#aaa' : '#666',
                  marginTop: 4, textAlign: 'center',
                  display: window.innerWidth < 480 && !active ? 'none' : 'block',
                }}>
                  {label}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 2, height: 2, background: i < step ? SK.yellow : '#333', margin: '0 4px', marginBottom: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ color: SK.red, fontSize: 12, marginTop: 4 }} role="alert">{msg}</div>;
}

function Label({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: SK.text, marginBottom: 6 }}>
      {children}{required && <span style={{ color: SK.red, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function Input({ value, onChange, type = 'text', placeholder, hasError, autoComplete, inputMode, ...rest }) {
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
        border: `1.5px solid ${hasError ? SK.red : focused ? SK.borderFocus : SK.border}`,
        borderRadius: 8, fontSize: 16, fontFamily: '"DM Sans", system-ui, sans-serif',
        background: SK.white, color: SK.text, outline: 'none',
        transition: 'border-color 0.15s',
      }}
      {...rest}
    />
  );
}

function Select({ value, onChange, children, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '12px 14px', boxSizing: 'border-box',
        border: `1.5px solid ${hasError ? SK.red : focused ? SK.borderFocus : SK.border}`,
        borderRadius: 8, fontSize: 16, fontFamily: '"DM Sans", system-ui, sans-serif',
        background: SK.white, color: value ? SK.text : SK.textLight, outline: 'none',
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
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '16px', borderRadius: 10, border: 'none',
        background: disabled || loading ? '#E5E7EB' : hovered ? SK.yellowDark : SK.yellow,
        color: disabled || loading ? '#9CA3AF' : SK.black,
        fontSize: 16, fontWeight: 700, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading && (
        <span style={{
          width: 18, height: 18, border: `2px solid ${SK.black}`, borderTopColor: 'transparent',
          borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '14px', borderRadius: 10,
        border: `1.5px solid ${SK.border}`,
        background: hovered ? '#F9FAFB' : SK.white,
        color: SK.textMuted, fontSize: 15, fontWeight: 600,
        cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepBinSize({ data, setData, errors }) {
  return (
    <section aria-labelledby="step1-heading">
      <h2 id="step1-heading" style={{ fontSize: 22, fontWeight: 700, color: SK.text, marginBottom: 4 }}>
        Choose Your Bin Size
      </h2>
      <p style={{ fontSize: 14, color: SK.textMuted, marginBottom: 24 }}>
        All prices include delivery, collection and standard waste disposal.
      </p>

      {errors.binSize && (
        <div style={{ background: SK.redBg, border: `1px solid ${SK.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: SK.red, fontSize: 14 }}>
          {errors.binSize}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {BIN_SIZES.map(bin => {
          const selected = data.binSize === bin.id;
          return (
            <button
              key={bin.id}
              onClick={() => setData(d => ({ ...d, binSize: bin.id }))}
              aria-pressed={selected}
              style={{
                background: selected ? SK.yellowLight : SK.card,
                border: `2px solid ${selected ? SK.yellow : SK.border}`,
                borderRadius: 12, padding: '20px', cursor: 'pointer',
                textAlign: 'left', position: 'relative',
                boxShadow: selected ? `0 0 0 2px ${SK.yellow}` : SK.shadow,
                transition: 'all 0.15s',
              }}
            >
              {bin.popular && (
                <div style={{
                  position: 'absolute', top: -1, right: 12,
                  background: SK.yellow, color: SK.black,
                  fontSize: 10, fontWeight: 700, padding: '2px 8px',
                  borderRadius: '0 0 6px 6px', letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  Most Popular
                </div>
              )}

              {/* Bin visual — proportional rectangle */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: { '2m3': 28, '4m3': 36, '6m3': 44, '8m3': 52 }[bin.id],
                  height: { '2m3': 28, '4m3': 36, '6m3': 44, '8m3': 52 }[bin.id],
                  background: selected ? SK.yellow : '#E5E7EB',
                  border: `2px solid ${selected ? SK.yellowDark : '#9CA3AF'}`,
                  borderRadius: '3px 3px 6px 6px',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: -3, left: 3, right: 3, height: 3,
                    background: selected ? SK.yellowDark : '#9CA3AF', borderRadius: 2,
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: SK.text, lineHeight: 1 }}>
                    {bin.label}
                  </div>
                  <div style={{ fontSize: 12, color: SK.textMuted, marginTop: 2 }}>{bin.capacity}</div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: SK.textMuted, marginBottom: 12, lineHeight: 1.5 }}>{bin.desc}</p>

              <div style={{
                fontSize: 22, fontWeight: 800, color: selected ? SK.black : SK.text,
                borderTop: `1px solid ${selected ? '#E9D80F' : SK.border}`, paddingTop: 12,
              }}>
                ${bin.price}
                <span style={{ fontSize: 13, fontWeight: 400, color: SK.textMuted }}> inc. GST</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StepCustomerDetails({ data, setData, errors }) {
  const field = (key) => ({
    value: data[key],
    onChange: e => setData(d => ({ ...d, [key]: e.target.value })),
    hasError: !!errors[key],
  });

  return (
    <section aria-labelledby="step2-heading">
      <h2 id="step2-heading" style={{ fontSize: 22, fontWeight: 700, color: SK.text, marginBottom: 4 }}>
        Your Details
      </h2>
      <p style={{ fontSize: 14, color: SK.textMuted, marginBottom: 24 }}>
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

function StepDeliveryDetails({ data, setData, errors }) {
  const field = (key) => ({
    value: data[key],
    onChange: e => setData(d => ({ ...d, [key]: e.target.value })),
    hasError: !!errors[key],
  });

  const [focusedTA, setFocusedTA] = useState(false);

  return (
    <section aria-labelledby="step3-heading">
      <h2 id="step3-heading" style={{ fontSize: 22, fontWeight: 700, color: SK.text, marginBottom: 4 }}>
        Delivery Details
      </h2>
      <p style={{ fontSize: 14, color: SK.textMuted, marginBottom: 24 }}>
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
            <Input
              {...field('collectionDate')} type="date"
              min={minCollectionStr(data.deliveryDate)}
            />
            <FieldError msg={errors.collectionDate} />
          </div>
        </div>

        <div>
          <Label required>Type of Waste</Label>
          <Select {...field('wasteType')}>
            <option value="">Select waste type…</option>
            {WASTE_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
          </Select>
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
              border: `1.5px solid ${focusedTA ? SK.borderFocus : SK.border}`,
              borderRadius: 8, fontSize: 15, fontFamily: '"DM Sans", system-ui, sans-serif',
              background: SK.white, color: SK.text, outline: 'none', resize: 'vertical',
              minHeight: 80, transition: 'border-color 0.15s',
            }}
          />
          <div style={{ fontSize: 12, color: SK.textLight, marginTop: 4 }}>Optional</div>
        </div>

        {/* Note about prohibited items */}
        <div style={{ background: '#FFF8E1', border: '1px solid #F5E642', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#7A6500' }}>
          <strong>Prohibited items:</strong> Tyres, asbestos (separate service available), chemicals, paint, gas cylinders, medical waste. Contact us if unsure.
        </div>
      </div>
    </section>
  );
}

function StepReview({ data, termsChecked, setTermsChecked, errors }) {
  const bin = BIN_SIZES.find(b => b.id === data.binSize);
  const rows = [
    { label: 'Bin Size', value: bin?.label },
    { label: 'Delivery Address', value: `${data.address}, ${data.suburb} ${data.postcode}` },
    { label: 'Delivery Date', value: formatDate(data.deliveryDate) },
    { label: 'Collection Date', value: formatDate(data.collectionDate) },
    { label: 'Waste Type', value: data.wasteType },
    { label: 'Name', value: data.customerName },
    { label: 'Email', value: data.customerEmail },
    { label: 'Phone', value: data.customerPhone },
    ...(data.specialInstructions ? [{ label: 'Special Instructions', value: data.specialInstructions }] : []),
  ];

  const [cbHovered, setCbHovered] = useState(false);

  return (
    <section aria-labelledby="step4-heading">
      <h2 id="step4-heading" style={{ fontSize: 22, fontWeight: 700, color: SK.text, marginBottom: 4 }}>
        Review Your Booking
      </h2>
      <p style={{ fontSize: 14, color: SK.textMuted, marginBottom: 24 }}>
        Please check everything looks correct before confirming.
      </p>

      {/* Price summary */}
      <div style={{
        background: SK.yellowLight, border: `2px solid ${SK.yellow}`, borderRadius: 12,
        padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, color: SK.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Price</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: SK.black, lineHeight: 1.1 }}>${bin?.price}</div>
          <div style={{ fontSize: 12, color: SK.textMuted, marginTop: 2 }}>Includes GST, delivery & collection</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: SK.textMuted }}>Hire period</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: SK.text }}>
            {data.deliveryDate && data.collectionDate
              ? `${Math.round((new Date(data.collectionDate) - new Date(data.deliveryDate)) / 86400000)} days`
              : '—'}
          </div>
        </div>
      </div>

      {/* Details table */}
      <div style={{ background: SK.card, border: `1px solid ${SK.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, padding: '12px 16px',
            borderBottom: i < rows.length - 1 ? `1px solid ${SK.border}` : 'none',
            background: i % 2 === 0 ? SK.white : '#FAFAFA',
          }}>
            <div style={{ fontSize: 13, color: SK.textMuted, fontWeight: 600, minWidth: 140, flexShrink: 0 }}>{r.label}</div>
            <div style={{ fontSize: 14, color: SK.text, wordBreak: 'break-word' }}>{r.value}</div>
          </div>
        ))}
      </div>

      {/* Terms */}
      <div>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
          padding: '12px 14px',
          background: errors.terms ? SK.redBg : cbHovered ? '#F9FAFB' : SK.white,
          border: `1.5px solid ${errors.terms ? SK.red : SK.border}`,
          borderRadius: 8, transition: 'background 0.15s',
        }}
          onMouseEnter={() => setCbHovered(true)}
          onMouseLeave={() => setCbHovered(false)}
        >
          <input
            type="checkbox"
            checked={termsChecked}
            onChange={e => setTermsChecked(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, cursor: 'pointer', flexShrink: 0, accentColor: SK.black }}
          />
          <span style={{ fontSize: 13, color: SK.text, lineHeight: 1.5 }}>
            I agree to Binned-IT&rsquo;s booking terms. I confirm the delivery address is accessible for a skip bin truck and that I will not dispose of prohibited items. I understand that the hire period starts on the delivery date.
          </span>
        </label>
        <FieldError msg={errors.terms} />
      </div>
    </section>
  );
}

function SuccessScreen({ bookingRef, binSize, deliveryDate, customerEmail }) {
  const bin = BIN_SIZES.find(b => b.id === binSize);
  return (
    <div style={{ minHeight: '100vh', background: SK.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        {/* Success icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: SK.greenBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 32,
        }}>
          ✓
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: SK.text, marginBottom: 8 }}>Booking Confirmed!</h1>
        <p style={{ fontSize: 16, color: SK.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
          Thanks for booking with Binned-IT. We&rsquo;ll be in touch shortly to confirm your delivery.
        </p>

        {bookingRef && (
          <div style={{ background: SK.yellowLight, border: `2px solid ${SK.yellow}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: SK.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Booking Reference</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: SK.black, letterSpacing: '0.08em' }}>#{bookingRef}</div>
          </div>
        )}

        <div style={{ background: SK.card, border: `1px solid ${SK.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: SK.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>What happens next</div>
          {[
            { step: '1', text: 'You\'ll receive a confirmation email shortly' },
            { step: '2', text: `Your ${bin?.label || 'skip bin'} will be delivered on ${formatDate(deliveryDate)}` },
            { step: '3', text: 'Our driver will call 30 minutes before arrival' },
            { step: '4', text: 'Fill your bin and we\'ll collect it on the agreed date' },
          ].map(({ step, text }) => (
            <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: SK.yellow, color: SK.black, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step}</div>
              <div style={{ fontSize: 14, color: SK.text, paddingTop: 3 }}>{text}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, color: SK.textMuted }}>
          Questions? Call us on <a href="tel:0395552000" style={{ color: SK.black, fontWeight: 700 }}>03 9555 2000</a> or email{' '}
          <a href="mailto:bookings@binned-it.com.au" style={{ color: SK.black, fontWeight: 700 }}>bookings@binned-it.com.au</a>
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function BookingPage() {
  useSEO();

  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    binSize: '', customerName: '', customerEmail: '', customerPhone: '',
    address: '', suburb: '', postcode: '',
    deliveryDate: '', collectionDate: '', wasteType: '', specialInstructions: '',
  });
  const [errors, setErrors] = useState({});
  const [termsChecked, setTermsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const selectedBin = BIN_SIZES.find(b => b.id === data.binSize);

  // Scroll to top on step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const goNext = useCallback(() => {
    const errs = validate(step, data);
    if (step === 3 && !termsChecked) errs.terms = 'Please accept the terms and conditions.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    if (step < 3) { setStep(s => s + 1); return; }

    // Final submit
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
            bin_size:             data.binSize,
            waste_type:           data.wasteType,
            delivery_date:        data.deliveryDate,
            collection_date:      data.collectionDate,
            special_instructions: data.specialInstructions?.trim() || null,
            price:                selectedBin.price,
            status:               'pending',
          })
          .select('id')
          .single();

        if (error) throw error;

        const ref = booking.id.slice(0, 8).toUpperCase();
        setBookingRef(ref);

        // Send confirmation email — best-effort, non-blocking
        fetch('/api/book-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId:    booking.id,
            bookingRef:   ref,
            customerName: data.customerName.trim(),
            customerEmail: data.customerEmail.trim().toLowerCase(),
            binSize:      selectedBin.label,
            deliveryDate: data.deliveryDate,
            price:        selectedBin.price,
            suburb:       data.suburb.trim(),
          }),
        }).catch(err => console.warn('[book-confirm] email call failed (non-fatal):', err.message));

        setSubmitted(true);
      } catch (err) {
        setSubmitError(err.message || 'Something went wrong. Please try again or call us.');
      } finally {
        setSubmitting(false);
      }
    })();
  }, [step, data, termsChecked, selectedBin]);

  const goBack = () => { setErrors({}); setStep(s => s - 1); };

  if (submitted) {
    return (
      <SuccessScreen
        bookingRef={bookingRef}
        binSize={data.binSize}
        deliveryDate={data.deliveryDate}
        customerEmail={data.customerEmail}
      />
    );
  }

  return (
    <>
      {/* Spinner keyframe animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: SK.bg, minHeight: '100vh', fontFamily: '"DM Sans", system-ui, sans-serif', color: SK.text }}>

        {/* ── Header ── */}
        <header style={{ background: SK.black, padding: '0 24px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: SK.yellow, letterSpacing: '0.03em', lineHeight: 1 }}>
                BINNED-IT
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Skip Bin Hire — Seaford, Melbourne</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'right' }}>
              <a href="tel:0395552000" style={{ color: SK.yellow, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                03 9555 2000
              </a>
              <div style={{ fontSize: 11, color: '#888' }}>Mon–Sat 7am–5pm</div>
            </div>
          </div>
        </header>

        {/* ── Hero strip ── */}
        <div style={{ background: SK.yellow, padding: '12px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: SK.black, margin: 0 }}>
            Same-day &amp; next-day delivery available &mdash; Book before 10am
          </p>
        </div>

        {/* ── Progress bar ── */}
        <ProgressBar step={step} />

        {/* ── Form card ── */}
        <main style={{ maxWidth: 700, margin: '32px auto', padding: '0 16px 48px' }}>
          <div style={{ background: SK.card, borderRadius: 16, boxShadow: SK.shadowLg, padding: '32px 28px' }}>

            {step === 0 && <StepBinSize data={data} setData={setData} errors={errors} />}
            {step === 1 && <StepCustomerDetails data={data} setData={setData} errors={errors} />}
            {step === 2 && <StepDeliveryDetails data={data} setData={setData} errors={errors} />}
            {step === 3 && <StepReview data={data} termsChecked={termsChecked} setTermsChecked={setTermsChecked} errors={errors} />}

            {/* Submit error */}
            {submitError && (
              <div style={{ background: SK.redBg, border: `1px solid ${SK.red}`, borderRadius: 8, padding: '12px 14px', marginTop: 16, color: SK.red, fontSize: 14 }}>
                {submitError}
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
              <PrimaryButton onClick={goNext} loading={submitting}>
                {step < 3 ? `Continue to ${STEPS[step + 1]}` : submitting ? 'Submitting…' : 'Confirm Booking'}
              </PrimaryButton>
              {step > 0 && (
                <SecondaryButton onClick={goBack}>&larr; Back</SecondaryButton>
              )}
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
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SK.textMuted }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </main>

        {/* ── Footer ── */}
        <footer style={{ background: SK.black, color: '#888', padding: '20px 24px', textAlign: 'center', fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            &copy; {new Date().getFullYear()} Binned-IT Pty Ltd &mdash; Seaford, VIC 3198 &mdash;{' '}
            <a href="mailto:info@binned-it.com.au" style={{ color: SK.yellow, textDecoration: 'none' }}>info@binned-it.com.au</a>
          </p>
        </footer>
      </div>
    </>
  );
}

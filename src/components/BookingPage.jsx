import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BookingForm, { FALLBACK_BINS } from './booking/BookingForm';

// ─────────────────────────────────────────────────────────────────────────────
// BookingPage — public booking page at `/book` for the default Binned-IT
// tenant (slug `binned-it`, seeded by migration 012).
//
// Sprint 16 #37: the actual multi-step form is now provided by the shared
// `<BookingForm>` component (also used by `/embed/<slug>`). This page is a
// thin shell that:
//   1. Loads the default `binned-it` tenant + its `tenant_bin_sizes` rows
//      from Supabase (the SAME source of truth used by the embed widget),
//      falling back to FALLBACK_BINS if Supabase is unreachable.
//   2. Injects the `/book`-specific SEO meta + JSON-LD on mount and tears it
//      down on unmount. The embed widget intentionally does NOT inject SEO.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_SLUG = 'binned-it';

// Hardcoded fallback tenant for offline / preview when Supabase is unreachable.
// Mirrors the seed in migration 012 so the page still renders correctly.
const FALLBACK_TENANT = {
  id: null,
  slug: DEFAULT_TENANT_SLUG,
  company_name: 'Binned-IT Pty Ltd',
  primary_color: '#EFDF0F',
  secondary_color: '#000006',
  phone: '03 9555 2000',
  email: 'bookings@binned-it.com.au',
  suburb: 'Seaford',
  logo_url: null,
  terms_url: null,
};

// ─── SEO — inject meta tags and JSON-LD on mount, restore on unmount ─────────
function useSEO(tenant, bins) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Book a Skip Bin Online | Binned-IT | Seaford, Melbourne';

    function setMeta(attr, attrVal, content) {
      let el = document.querySelector(`meta[${attr}="${attrVal}"]`);
      let created = false;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrVal);
        document.head.appendChild(el);
        created = true;
      }
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

    const prices = (bins || []).map(b => Number(b.price)).filter(n => Number.isFinite(n));
    const priceRange = prices.length
      ? `$${Math.min(...prices)}–$${Math.max(...prices)}`
      : '$195–$435';

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: tenant?.company_name || 'Binned-IT Pty Ltd',
      description: 'Skip bin hire in Seaford, Melbourne. 2m³ to 8m³ bins for household and commercial waste.',
      url: 'https://binnedit-hub.vercel.app/book',
      address: {
        '@type': 'PostalAddress',
        streetAddress: tenant?.suburb || 'Seaford',
        addressLocality: tenant?.suburb || 'Seaford',
        addressRegion: 'VIC',
        postalCode: '3198',
        addressCountry: 'AU',
      },
      priceRange,
      areaServed: { '@type': 'State', name: 'Victoria' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Skip Bin Hire',
        itemListElement: (bins || []).map(b => ({
          '@type': 'Offer',
          name: b.size_label,
          description: b.description,
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
  }, [tenant, bins]);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const [tenant, setTenant] = useState(FALLBACK_TENANT);
  const [bins, setBins] = useState(FALLBACK_BINS);

  // Resolve the seeded `binned-it` tenant + its bin sizes. Anything goes
  // wrong (no migrations, RLS deny, network) → keep FALLBACK_TENANT/BINS.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', DEFAULT_TENANT_SLUG)
          .eq('active', true)
          .single();

        if (cancelled || tenantErr || !tenantData) return;
        setTenant(tenantData);

        const { data: binData } = await supabase
          .from('tenant_bin_sizes')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('sort_order', { ascending: true });

        if (cancelled) return;
        if (binData?.length) setBins(binData);
      } catch (_err) {
        // Keep fallback — no-op.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useSEO(tenant, bins);

  return <BookingForm tenant={tenant} bins={bins} />;
}

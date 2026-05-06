import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BookingForm, { makePalette, FALLBACK_BINS } from './booking/BookingForm';

// ─────────────────────────────────────────────────────────────────────────────
// EmbedBookingPage — Sprint 11 white-label tenant-scoped booking widget.
//
// Sprint 16 #37: this page now resolves the tenant + bin sizes from Supabase
// (`tenants` joined to `tenant_bin_sizes` by `tenant_id`) and delegates the
// actual multi-step form to `<BookingForm>` — the shared component that also
// powers `/book`. The only embed-specific responsibility left here is loading
// the tenant by slug and surfacing loading / error states.
// ─────────────────────────────────────────────────────────────────────────────

function LoadingScreen({ palette }) {
  return (
    <div
      style={{
        minHeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        color: palette.textMuted,
        fontSize: 15,
        background: palette.bg,
      }}
    >
      Loading…
    </div>
  );
}

function ErrorScreen({ message, palette }) {
  return (
    <div
      style={{
        minHeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        fontFamily: '"DM Sans", system-ui, sans-serif',
        background: palette.bg,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🗑️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: palette.text, marginBottom: 8 }}>
          Widget Unavailable
        </h2>
        <p style={{ fontSize: 14, color: palette.textMuted, lineHeight: 1.6 }}>
          {message || 'This booking widget could not be loaded. Please contact the website owner.'}
        </p>
      </div>
    </div>
  );
}

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

        const { data: binData } = await supabase
          .from('tenant_bin_sizes')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('sort_order', { ascending: true });

        setBins(binData?.length ? binData : FALLBACK_BINS);
      } catch (_err) {
        // Supabase unreachable — fall back to a sensible default so the embed
        // is still usable for previews / dev.
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

  if (loading) return <LoadingScreen palette={palette} />;
  if (loadError) return <ErrorScreen message={loadError} palette={palette} />;

  return <BookingForm tenant={tenant} bins={bins} />;
}

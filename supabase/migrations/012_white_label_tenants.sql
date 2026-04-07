-- ============================================================
-- Migration 012: White-Label Booking Widget
-- Binned-IT Dashboard Hub v2.2
-- Phase: White-Label MVP (iframe embed approach)
-- ============================================================

-- ── Tenants ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text        UNIQUE NOT NULL,
  company_name            text        NOT NULL,
  logo_url                text,
  primary_color           text        NOT NULL DEFAULT '#EFDF0F',
  secondary_color         text        NOT NULL DEFAULT '#000006',
  phone                   text,
  email                   text,
  website                 text,
  address                 text,
  suburb                  text,
  service_area_postcodes  text[],
  terms_url               text,
  active                  boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);

-- ── Tenant bin sizes ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_bin_sizes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  size_label  text        NOT NULL,
  volume_m3   numeric(4,1),
  description text,
  price       numeric(10,2) NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  popular     boolean     NOT NULL DEFAULT false,
  UNIQUE (tenant_id, size_label)
);

CREATE INDEX IF NOT EXISTS idx_tenant_bin_sizes_tenant ON public.tenant_bin_sizes(tenant_id);

-- ── Add tenant_id to bookings (nullable — existing rows stay intact) ──

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings(tenant_id);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read active tenants for the embed widget
CREATE POLICY IF NOT EXISTS "Public can read active tenants"
  ON public.tenants
  FOR SELECT
  USING (active = true);

-- Owner can manage all tenant config
CREATE POLICY IF NOT EXISTS "Owner can manage tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner');

ALTER TABLE public.tenant_bin_sizes ENABLE ROW LEVEL SECURITY;

-- Anyone can read bin sizes (needed for embed widget, no auth)
CREATE POLICY IF NOT EXISTS "Public can read tenant bin sizes"
  ON public.tenant_bin_sizes
  FOR SELECT
  USING (true);

-- Owner can manage bin sizes
CREATE POLICY IF NOT EXISTS "Owner can manage tenant bin sizes"
  ON public.tenant_bin_sizes
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'owner');

-- ── Anon booking insert already covered by existing policy ─
-- The existing "anon can insert bookings" policy on the bookings table
-- automatically covers the new nullable tenant_id column — no change needed.

-- ── Seed: demo tenant ──────────────────────────────────────

INSERT INTO public.tenants (
  slug, company_name, logo_url,
  primary_color, secondary_color,
  phone, email, website,
  address, suburb,
  service_area_postcodes,
  terms_url, active
) VALUES (
  'binned-it',
  'Binned-IT Pty Ltd',
  null,
  '#EFDF0F',
  '#000006',
  '03 9555 2000',
  'bookings@binned-it.com.au',
  'https://binnedit-hub.vercel.app',
  '1 Skip Street',
  'Seaford',
  ARRAY['3198','3199','3200','3201','3204','3206','3207','3930'],
  null,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: bin sizes for demo tenant ───────────────────────

INSERT INTO public.tenant_bin_sizes
  (tenant_id, size_label, volume_m3, description, price, sort_order, popular)
SELECT
  t.id,
  v.size_label,
  v.volume_m3,
  v.description,
  v.price,
  v.sort_order,
  v.popular
FROM public.tenants t,
(VALUES
  ('2m³ Mini Skip',  2.0::numeric,
   'Perfect for small clean-ups, garage clear-outs or minor bathroom renos. Approx. 10–12 wheelie bins.',
   195.00::numeric, 1, true),
  ('4m³ Small Skip', 4.0::numeric,
   'Great for kitchen or bathroom renovations and medium household clean-ups. Approx. 30–35 wheelie bins.',
   275.00::numeric, 2, false),
  ('6m³ Medium Skip', 6.0::numeric,
   'Ideal for large renovations, landscaping projects or business clear-outs. Approx. 50–55 wheelie bins.',
   355.00::numeric, 3, false),
  ('8m³ Large Skip',  8.0::numeric,
   'Best for major construction, full property clear-outs or commercial jobs. Approx. 70–80 wheelie bins.',
   435.00::numeric, 4, false)
) AS v(size_label, volume_m3, description, price, sort_order, popular)
WHERE t.slug = 'binned-it'
ON CONFLICT (tenant_id, size_label) DO NOTHING;

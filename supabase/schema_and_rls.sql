-- Supabase setup for FFMA
-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Field Visit Logging Table
CREATE TABLE IF NOT EXISTS public.core_fieldvisit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.core_farmer(id) ON DELETE CASCADE,
    plot_id UUID REFERENCES public.core_plot(id) ON DELETE SET NULL,
    staff_id UUID NOT NULL REFERENCES public.core_user(id) ON DELETE CASCADE,
    purpose VARCHAR(50) NOT NULL DEFAULT 'Routine Visit',
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Verified',
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    duration_minutes INT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    gps_accuracy NUMERIC(8, 2),
    distance_from_plot NUMERIC(10, 2),
    inside_radius BOOLEAN DEFAULT TRUE,
    photo_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_id UUID REFERENCES public.core_user(id) ON DELETE SET NULL
);

-- Visit Photos Table
CREATE TABLE IF NOT EXISTS public.core_visitphoto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES public.core_fieldvisit(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Call Logs Table
CREATE TABLE IF NOT EXISTS public.core_calllog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.core_farmer(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.core_user(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL DEFAULT 'Outgoing',
    call_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration INT,
    outcome VARCHAR(50) NOT NULL DEFAULT 'Other',
    notes TEXT,
    next_action VARCHAR(255),
    followup_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recommendation Messages Table
CREATE TABLE IF NOT EXISTS public.core_recommendationmessage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES public.core_recommendation(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL DEFAULT 'Internal',
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    sent_time TIMESTAMPTZ,
    content TEXT NOT NULL,
    delivery_status VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for Performance (<1s responses)
CREATE INDEX IF NOT EXISTS idx_fieldvisit_farmer ON public.core_fieldvisit(farmer_id);
CREATE INDEX IF NOT EXISTS idx_fieldvisit_staff ON public.core_fieldvisit(staff_id);
CREATE INDEX IF NOT EXISTS idx_fieldvisit_created ON public.core_fieldvisit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calllog_farmer ON public.core_calllog(farmer_id);
CREATE INDEX IF NOT EXISTS idx_calllog_staff ON public.core_calllog(staff_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_farmer ON public.core_recommendation(farmer_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_created ON public.core_recommendation(timestamp DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.core_fieldvisit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_visitphoto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_calllog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_recommendationmessage ENABLE ROW LEVEL SECURITY;

-- Field Visits RLS Policies
CREATE POLICY "Staff can view own visits" ON public.core_fieldvisit
    FOR SELECT USING (staff_id = uuid(current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Staff can insert own visits" ON public.core_fieldvisit
    FOR INSERT WITH CHECK (staff_id = uuid(current_setting('request.jwt.claim.sub', true)));

-- Call Logs RLS Policies
CREATE POLICY "Staff can view own call logs" ON public.core_calllog
    FOR SELECT USING (staff_id = uuid(current_setting('request.jwt.claim.sub', true)));

CREATE POLICY "Staff can insert own call logs" ON public.core_calllog
    FOR INSERT WITH CHECK (staff_id = uuid(current_setting('request.jwt.claim.sub', true)));

-- 5. Storage Bucket Configuration for Visit Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read for visit photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'visit-photos');

CREATE POLICY "Authenticated users can upload visit photos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'visit-photos' AND auth.role() = 'authenticated');

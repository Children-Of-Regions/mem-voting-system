-- ============================================
-- MEM Award Voting System - Complete Database Setup
-- ============================================
-- This script sets up the entire database from scratch
-- WARNING: This will DELETE all existing data!

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CLEANUP (DROPS ALL TABLES)
-- ============================================
DROP TABLE IF EXISTS voting_codes CASCADE;
DROP TABLE IF EXISTS nominees CASCADE;
DROP TABLE IF EXISTS voting_config CASCADE;

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Voting Configuration
CREATE TABLE voting_config (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    results_public BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default config
INSERT INTO voting_config (id, status, results_public) VALUES (1, 'active', false);

-- Nominees
CREATE TABLE nominees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_id INTEGER REFERENCES voting_config(id) DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Voting Codes (Format: XXX-XXX) with Email Status
CREATE TABLE voting_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_id INTEGER REFERENCES voting_config(id) DEFAULT 1,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'),
    email TEXT UNIQUE,
    
    -- Email sending status
    email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_error TEXT,
    
    -- Voting status
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP WITH TIME ZONE,
    nominee_id UUID REFERENCES nominees(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes for faster queries
CREATE INDEX idx_voting_codes_email_status ON voting_codes(email_status);
CREATE INDEX idx_voting_codes_email ON voting_codes(email);
CREATE INDEX idx_voting_codes_created_at ON voting_codes(created_at DESC);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE voting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_codes ENABLE ROW LEVEL SECURITY;

-- Policies for voting_config
CREATE POLICY "Public Read Config" ON voting_config 
    FOR SELECT TO anon, authenticated 
    USING (true);

CREATE POLICY "Admin All Config" ON voting_config 
    FOR ALL TO authenticated 
    USING (true) WITH CHECK (true);

-- Policies for nominees
CREATE POLICY "Public Read Nominees" ON nominees 
    FOR SELECT TO anon, authenticated 
    USING (true);

CREATE POLICY "Admin All Nominees" ON nominees 
    FOR ALL TO authenticated 
    USING (true) WITH CHECK (true);

-- Policies for voting_codes
-- RESTRICTED: Public cannot read table directly. Must use functions.
CREATE POLICY "Admin All Codes" ON voting_codes 
    FOR ALL TO authenticated 
    USING (true) WITH CHECK (true);

-- ============================================
-- 4. FUNCTIONS (RPC)
-- ============================================

-- Check Voting Code Function (Public)
CREATE OR REPLACE FUNCTION check_voting_code(code_input TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    code_record RECORD;
BEGIN
    SELECT * INTO code_record FROM voting_codes WHERE code = code_input;
    
    IF code_record IS NULL THEN
        RETURN json_build_object('valid', false, 'message', 'Անվավեր կոդ');
    END IF;

    IF code_record.is_used THEN
        RETURN json_build_object('valid', false, 'message', 'Այս կոդն արդեն օգտագործված է');
    END IF;

    RETURN json_build_object('valid', true, 'message', 'Վավեր կոդ');
END;
$$;

-- Secure Submit Vote Function
CREATE OR REPLACE FUNCTION submit_vote(code_input TEXT, nominee_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    code_record RECORD;
    config_record RECORD;
BEGIN
    -- Check if voting is active
    SELECT * INTO config_record FROM voting_config WHERE id = 1;
    IF config_record.status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Քվեարկությունը փակ է');
    END IF;

    -- Find the code
    SELECT * INTO code_record FROM voting_codes WHERE code = code_input FOR UPDATE;

    -- Validate code
    IF code_record IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Անվավեր կոդ');
    END IF;

    IF code_record.is_used THEN
        RETURN json_build_object('success', false, 'message', 'Այս կոդն արդեն օգտագործված է');
    END IF;

    -- Mark code as used
    UPDATE voting_codes 
    SET is_used = true, 
        used_at = NOW(), 
        nominee_id = submit_vote.nominee_id 
    WHERE id = code_record.id;

    -- Increment vote count
    UPDATE nominees 
    SET vote_count = vote_count + 1 
    WHERE id = submit_vote.nominee_id;

    RETURN json_build_object('success', true, 'message', 'Ձեր ձայնը հաջողությամբ ընդունված է');
END;
$$;

-- Reset All Data Function (Admin only)
CREATE OR REPLACE FUNCTION reset_all_voting_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete all codes first (child table)
    DELETE FROM voting_codes WHERE true;

    -- Delete all nominees (parent table)
    DELETE FROM nominees WHERE true;
    
    -- Reset config
    UPDATE voting_config SET status = 'active', results_public = false WHERE id = 1;
END;
$$;

-- ============================================
-- 5. STORAGE SETUP
-- ============================================

-- Create bucket for nominee images
INSERT INTO storage.buckets (id, name, public)
VALUES ('nominee-images', 'nominee-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'nominee-images');

CREATE POLICY "Authenticated Upload" ON storage.objects 
    FOR INSERT TO authenticated 
    WITH CHECK (bucket_id = 'nominee-images');

CREATE POLICY "Authenticated Update" ON storage.objects 
    FOR UPDATE TO authenticated 
    USING (bucket_id = 'nominee-images');

CREATE POLICY "Authenticated Delete" ON storage.objects 
    FOR DELETE TO authenticated 
    USING (bucket_id = 'nominee-images');

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Email status is now part of voting_codes table
-- No separate email_logs table needed!

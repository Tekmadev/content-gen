-- Add brand logo URL to brand_settings
ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- Migration to update default theme from 'dark' to 'light'
-- This migration updates existing users who still have the default 'dark' theme

-- Only update users who have never changed their theme preference
-- (assuming users who explicitly chose 'dark' will have other settings modified)
UPDATE users 
SET theme = 'light' 
WHERE theme = 'dark' 
  AND settings = '{}' -- Empty settings object indicates default user
  OR settings IS NULL;

-- For new users, the default is now 'light' in the model definition
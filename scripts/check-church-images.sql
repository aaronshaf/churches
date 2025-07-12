-- Check if church_images table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='church_images';

-- If it exists, check for any records
SELECT * FROM church_images;

-- Check for images for church 353
SELECT * FROM church_images WHERE church_id = 353;
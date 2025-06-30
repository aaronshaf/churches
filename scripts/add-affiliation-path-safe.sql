-- Add path column to affiliations table (without UNIQUE constraint initially)
ALTER TABLE affiliations ADD COLUMN path TEXT;

-- Generate paths for existing affiliations
UPDATE affiliations 
SET path = lower(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(name, ' ', '-'),
                    '&', 'and'
                  ),
                  '.', ''
                ),
                ',', ''
              ),
              '''', ''
            ),
            '"', ''
          ),
          '(', ''
        ),
        ')', ''
      ),
      '/', '-'
    ),
    '--', '-'
  )
)
WHERE path IS NULL;
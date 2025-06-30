-- Add path column to affiliations table
ALTER TABLE affiliations ADD COLUMN path TEXT UNIQUE;

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
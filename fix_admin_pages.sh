#\!/bin/bash

# Find all admin routes that fetch logoUrl but not navbarPages
echo "Finding admin routes missing navbarPages..."

# Routes to check
routes=(
  "app.get('/admin/affiliations/new'"
  "app.get('/admin/affiliations/:id/edit'"
  "app.get('/admin/churches/new'"
  "app.get('/admin/churches/:id/edit'"
  "app.get('/admin/counties/new'"
  "app.get('/admin/counties/:id/edit'"
  "app.get('/admin/pages/new'"
  "app.get('/admin/pages/:id/edit'"
  "app.get('/admin/settings'"
)

for route in "${routes[@]}"; do
  echo "Checking $route..."
  grep -n "$route" src/index.tsx
done

echo "Done."

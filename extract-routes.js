#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the index.tsx file
const indexPath = '/Users/ashafovaloff/github/churches/src/index.tsx';
const content = fs.readFileSync(indexPath, 'utf8');

// Define route patterns to extract
const routePatterns = [
  {
    name: 'networks',
    pattern: /^app\.get\('\/networks',.*?(?=^app\.)/gms,
    file: 'src/routes/public/networks.tsx'
  },
  {
    name: 'map',
    pattern: /^app\.get\('\/map',.*?(?=^app\.)/gms,
    file: 'src/routes/public/map.tsx'
  },
  {
    name: 'suggest-church-get',
    pattern: /^app\.get\('\/suggest-church',.*?(?=^app\.)/gms,
    file: 'src/routes/public/suggest-church.tsx'
  },
  {
    name: 'suggest-church-post',
    pattern: /^app\.post\('\/suggest-church',.*?(?=^app\.)/gms,
    file: 'src/routes/public/suggest-church.tsx'
  },
  {
    name: 'admin-monitoring',
    pattern: /^app\.get\('\/admin\/monitoring',.*?(?=^app\.)/gms,
    file: 'src/routes/admin-core/monitoring.tsx'
  },
  {
    name: 'admin-dashboard',
    pattern: /^app\.get\('\/admin', async \(c\) => {.*?(?=^app\.)/gms,
    file: 'src/routes/admin-core/dashboard.tsx'
  }
];

// Extract matches
const matches = {};
routePatterns.forEach(({ name, pattern }) => {
  const match = content.match(pattern);
  if (match) {
    matches[name] = match[0];
    console.log(`Found ${name}: ${match[0].substring(0, 50)}...`);
  } else {
    console.log(`No match for ${name}`);
  }
});

console.log('Extraction complete. Found', Object.keys(matches).length, 'routes');
#!/usr/bin/env node

/**
 * AST-grep script to check for TypeScript type assertions (" as " casting)
 * Helps identify potentially unsafe type assertions that might need review
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// ast-grep patterns to detect type assertions
const typeAssertionPatterns = [
  {
    pattern: '$EXPR as string',
    description: "Type assertion to 'string' - use type guard instead",
    severity: 'high',
  },
  {
    pattern: '$EXPR as number',
    description: "Type assertion to 'number' - use type guard instead",
    severity: 'high',
  },
  {
    pattern: '$EXPR as boolean',
    description: "Type assertion to 'boolean' - use type guard instead",
    severity: 'high',
  },
  {
    pattern: '$EXPR as any',
    description: "Type assertion to 'any' (prohibited)",
    severity: 'high',
  },
  {
    pattern: '$EXPR as $INTERFACE',
    description: 'Type assertion to interface/type - use type guard or validation',
    severity: 'medium',
  },
  {
    pattern: '$EXPR as never',
    description: "Type assertion to 'never' (exhaustiveness check)",
    severity: 'low',
  },
];

// Patterns to ignore completely (don't report these)
const ignoredPatterns = [
  // Safe TypeScript language features
  /as\s+const/, // Const assertions
  /as\s+unknown/, // Safe escape hatch
];

// Known safe assertion patterns that get downgraded to LOW severity
const safeAssertionPatterns = [
  // Type guards and validation results (after proper validation)
  /result\.\w+\s+as\s+\w+/,
  /validated\w*\s+as\s+\w+/,
  /parsed\w*\s+as\s+\w+/,

  // Database ID casts that are verified safe
  /comment\.churchId\s+as\s+number.*\/\/.*Safe\s+since/,
];

function getFilesToCheck() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Use provided files/directories
    return args.filter((arg) => fs.existsSync(arg));
  }

  // Default to src/ directory
  return ['src/'];
}

function checkWithAstGrep(pattern, description, severity, files) {
  try {
    const filesArg = Array.isArray(files) ? files.join(' ') : files;
    const cmd = `ast-grep --pattern '${pattern}' ${filesArg}`;

    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    if (result.trim()) {
      return {
        pattern,
        description,
        severity,
        output: result.trim(),
      };
    }
    return null;
  } catch (error) {
    // ast-grep returns non-zero exit code when no matches are found
    if (error.status === 1 && !error.stdout.trim()) {
      return null; // No matches found
    }
    // If there's actual stderr output, it might be a real error
    if (error.stderr && error.stderr.trim()) {
      console.error(`${colors.red}Error running ast-grep: ${error.stderr}${colors.reset}`);
    }
    return null;
  }
}

function shouldIgnoreAssertion(output) {
  // Check if the assertion should be completely ignored
  return ignoredPatterns.some((pattern) => pattern.test(output));
}

function isSafeAssertion(output) {
  // Check if the assertion matches known safe patterns
  return safeAssertionPatterns.some((pattern) => pattern.test(output));
}

function categorizeBySeverity(results) {
  const categorized = {
    high: [],
    medium: [],
    low: [],
    info: [],
  };

  for (const result of results) {
    // Check if it's a safe assertion and downgrade severity
    if (isSafeAssertion(result.output)) {
      categorized.low.push({
        ...result,
        description: `${result.description} (appears safe)`,
        severity: 'low',
      });
    } else {
      categorized[result.severity].push(result);
    }
  }

  return categorized;
}

function getSeverityColor(severity) {
  switch (severity) {
    case 'high':
      return colors.red;
    case 'medium':
      return colors.yellow;
    case 'low':
      return colors.cyan;
    case 'info':
      return colors.blue;
    default:
      return colors.reset;
  }
}

function getSeverityIcon(severity) {
  switch (severity) {
    case 'high':
      return '🚨';
    case 'medium':
      return '⚠️ ';
    case 'low':
      return '💡';
    case 'info':
      return 'ℹ️ ';
    default:
      return '';
  }
}

function formatResults(results) {
  if (results.length === 0) {
    console.log(`${colors.green}✅ No problematic type assertions found!${colors.reset}`);
    return 0;
  }

  const categorized = categorizeBySeverity(results);
  const totalCount = results.length;

  console.log(`${colors.blue}${colors.bold}🔍 Found ${totalCount} type assertion(s):${colors.reset}\n`);

  // Show summary by severity
  const severityOrder = ['high', 'medium', 'low', 'info'];
  for (const severity of severityOrder) {
    const items = categorized[severity];
    if (items.length > 0) {
      const color = getSeverityColor(severity);
      const icon = getSeverityIcon(severity);
      console.log(`${color}${icon}${severity.toUpperCase()}: ${items.length} assertion(s)${colors.reset}`);
    }
  }
  console.log('');

  // Show detailed results by severity
  for (const severity of severityOrder) {
    const items = categorized[severity];
    if (items.length === 0) continue;

    const color = getSeverityColor(severity);
    const icon = getSeverityIcon(severity);

    console.log(`${color}${colors.bold}${icon}${severity.toUpperCase()} SEVERITY${colors.reset}`);
    console.log(`${color}${'='.repeat(40)}${colors.reset}`);

    for (const item of items) {
      console.log(`${color}${colors.bold}Pattern: ${item.pattern}${colors.reset}`);
      console.log(`${color}Issue: ${item.description}${colors.reset}\n`);

      // Parse and format the ast-grep output
      const lines = item.output.split('\n');

      for (const line of lines) {
        if (line.includes(':')) {
          const [file, ...rest] = line.split(':');
          if (file && !line.startsWith(' ') && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
            console.log(`${colors.blue}📁 ${file}${colors.reset}`);
            if (rest.length > 0) {
              console.log(`  ${colors.magenta}Line ${rest[0]}:${colors.reset} ${rest.slice(1).join(':')}`);
            }
          } else {
            console.log(`  ${colors.magenta}${line}${colors.reset}`);
          }
        } else if (line.trim()) {
          console.log(`  ${line}`);
        }
      }
      console.log('');
    }
  }

  // Show recommendations
  console.log(`${colors.yellow}${colors.bold}📋 RECOMMENDATIONS:${colors.reset}`);

  if (categorized.high.length > 0) {
    console.log(
      `${colors.red}• HIGH priority: Fix ${categorized.high.length} assertion(s) - these need type guards${colors.reset}`
    );
  }

  if (categorized.medium.length > 0) {
    console.log(
      `${colors.yellow}• MEDIUM priority: Consider refactoring ${categorized.medium.length} assertion(s) with proper type guards${colors.reset}`
    );
  }

  if (categorized.low.length > 0) {
    console.log(
      `${colors.cyan}• LOW priority: ${categorized.low.length} assertion(s) are safe but documented for review${colors.reset}`
    );
  }

  console.log(`${colors.blue}• Use type guards: typeof x === 'string', Array.isArray(), etc.${colors.reset}`);
  console.log(`${colors.blue}• Use validation: zod.parse(), custom validators${colors.reset}`);
  console.log(`${colors.blue}• Safe assertions: 'as unknown', 'as const'${colors.reset}`);

  // Return error code if there are HIGH or MEDIUM severity issues
  const hasErrors = categorized.high.length > 0 || categorized.medium.length > 0;
  return hasErrors ? 1 : 0;
}

function showUsage() {
  console.log(`${colors.blue}${colors.bold}TypeScript Type Assertion Checker${colors.reset}`);
  console.log('');
  console.log('Usage:');
  console.log(
    `  ${colors.cyan}node scripts/check-type-assertions.js${colors.reset}                    # Check src/ directory`
  );
  console.log(
    `  ${colors.cyan}node scripts/check-type-assertions.js src/components/${colors.reset}     # Check specific directory`
  );
  console.log(
    `  ${colors.cyan}node scripts/check-type-assertions.js src/file.ts${colors.reset}         # Check specific file`
  );
  console.log(
    `  ${colors.cyan}node scripts/check-type-assertions.js src/ test/${colors.reset}          # Check multiple paths`
  );
  console.log('');
  console.log('Severity Levels:');
  console.log(`  ${colors.red}🚨 HIGH${colors.reset}    - Potentially unsafe assertions that need immediate review`);
  console.log(`  ${colors.yellow}⚠️  MEDIUM${colors.reset}  - Assertions that could be improved with type guards`);
  console.log(`  ${colors.cyan}💡 LOW${colors.reset}     - Generally safe assertions or known patterns`);
  console.log(`  ${colors.blue}ℹ️  INFO${colors.reset}    - Informational findings`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return 0;
  }

  console.log(`${colors.blue}${colors.bold}🔍 Checking for TypeScript type assertions with ast-grep...${colors.reset}`);

  // Check if ast-grep is available
  try {
    execSync('which ast-grep', { stdio: 'ignore' });
  } catch (error) {
    console.error(`${colors.red}❌ ast-grep is not installed or not in PATH${colors.reset}`);
    console.log(`${colors.yellow}Install ast-grep: https://ast-grep.github.io/guide/quick-start.html${colors.reset}`);
    console.log(`${colors.yellow}On macOS: brew install ast-grep${colors.reset}`);
    return 1;
  }

  const filesToCheck = getFilesToCheck();

  if (filesToCheck.length === 0) {
    console.log(`${colors.red}❌ No valid files or directories to check${colors.reset}`);
    showUsage();
    return 1;
  }

  console.log(`${colors.blue}Checking: ${filesToCheck.join(', ')}${colors.reset}\n`);

  const results = [];

  for (const { pattern, description, severity } of typeAssertionPatterns) {
    const result = checkWithAstGrep(pattern, description, severity, filesToCheck);

    if (result && !shouldIgnoreAssertion(result.output)) {
      results.push(result);
    }
  }

  return formatResults(results);
}

// Run the check
const exitCode = main();
process.exit(exitCode);

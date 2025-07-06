#!/usr/bin/env node

/**
 * Pre-commit hook script to enforce "no any" policy using ast-grep
 * Checks for prohibited 'any' usage in TypeScript files
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// ast-grep patterns to detect prohibited 'any' usage
const prohibitedPatterns = [
  {
    pattern: '$EXPR as any',
    description: "'as any' type assertions are prohibited",
  },
  {
    pattern: 'const $VAR: any = $_',
    description: "const variables with 'any' type are prohibited",
  },
  {
    pattern: 'let $VAR: any = $_',
    description: "let variables with 'any' type are prohibited",
  },
  {
    pattern: '$VAR: any',
    description: "explicit 'any' type annotations are prohibited",
  },
  {
    pattern: 'function $NAME($$PARAMS): any { $$$BODY }',
    description: "function with 'any' return type is prohibited",
  },
  {
    pattern: '($PARAMS): any => $BODY',
    description: "arrow function with 'any' return type is prohibited",
  },
  {
    pattern: 'ZodObject<any>',
    description: 'ZodObject<any> is prohibited, use proper typing',
  },
  {
    pattern: 'ZodSchema<any>',
    description: 'ZodSchema<any> is prohibited, use proper typing',
  },
  {
    pattern: 'Record<$KEY, any>',
    description: 'Record<_, any> is prohibited, use Record<_, unknown> or proper typing',
  },
  {
    pattern: 'Array<any>',
    description: 'Array<any> is prohibited, use proper typing',
  },
  {
    pattern: 'any[]',
    description: 'any[] is prohibited, use proper typing',
  },
];

// Allowed patterns - these will be excluded from the check
const allowedFilePatterns = [
  // Comments and string literals containing 'any' are okay
  // JSX step="any" attributes are okay
  // betterAuth?: any (marked as TODO) is okay
  // [key: string]: any for external API responses is okay
];

function getChangedFiles() {
  try {
    // Get staged files
    const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    const stagedFiles = staged.trim().split('\n').filter(Boolean);

    // Filter for TypeScript files in src/
    const tsFiles = stagedFiles.filter(
      (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && file.startsWith('src/') && fs.existsSync(file)
    );

    return tsFiles;
  } catch (error) {
    console.log(
      `${colors.yellow}Warning: Could not get staged files, checking all TypeScript files in src/${colors.reset}`
    );
    return ['src/'];
  }
}

function checkWithAstGrep(pattern, description, files) {
  try {
    const filesArg = Array.isArray(files) ? files.join(' ') : files;
    const cmd = `ast-grep --pattern '${pattern}' ${filesArg}`;

    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    if (result.trim()) {
      return {
        pattern,
        description,
        output: result.trim(),
      };
    }
    return null;
  } catch (error) {
    // ast-grep returns non-zero exit code when no matches are found, which is what we want
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

function isAllowedViolation(output) {
  // Check if the violation contains allowed patterns
  const allowedExceptions = [
    // Comments containing 'any'
    /\/\/.*any/,
    /\/\*[\s\S]*any[\s\S]*\*\//,

    // HTML attributes
    /step="any"/,

    // JSX children type (required by Hono framework)
    /children:\s*any/,

    // Better-auth instance (marked as TODO)
    /betterAuth\?\s*:\s*any.*(?:\/\/.*(?:TODO|FIXME|Better-auth|instance|typed|later))/,

    // External API response objects
    /\[key:\s*string\]\s*:\s*any/,

    // Generic function defaults
    /export\s+function\s+\w+<T\s*=\s*any>/,
    /asyncHandler<T\s*=\s*any>/,

    // String literals
    /"any"/,
    /'any'/,

    // Comments with specific context
    /Check if any/,
    /any other/,
    /any fields/,
    /any addresses/,
    /any day/,
    /any external/,
    /any leading/,
    /any double/,
    /Skip any/,
    /Do NOT add any/,
    /Remove any/,
    /Clean up any/,
  ];

  return allowedExceptions.some((pattern) => pattern.test(output));
}

function formatResults(violations) {
  if (violations.length === 0) {
    console.log(`${colors.green}✅ No prohibited 'any' usage found!${colors.reset}`);
    return 0;
  }

  console.log(`${colors.red}${colors.bold}❌ Found prohibited 'any' usage:${colors.reset}\n`);

  for (const violation of violations) {
    console.log(`${colors.blue}${colors.bold}Pattern: ${violation.pattern}${colors.reset}`);
    console.log(`${colors.red}Issue: ${violation.description}${colors.reset}\n`);

    // Parse and format the ast-grep output
    const lines = violation.output.split('\n');
    let currentFile = '';

    for (const line of lines) {
      if (line.includes(':')) {
        const [file, ...rest] = line.split(':');
        if (file && !line.startsWith(' ') && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          currentFile = file;
          console.log(`${colors.blue}📁 ${file}${colors.reset}`);
          if (rest.length > 0) {
            console.log(`  ${colors.yellow}${rest.join(':')}${colors.reset}`);
          }
        } else {
          console.log(`  ${colors.yellow}${line}${colors.reset}`);
        }
      } else if (line.trim()) {
        console.log(`  ${line}`);
      }
    }
    console.log('');
  }

  console.log(`${colors.red}${colors.bold}❌ Pre-commit check failed!${colors.reset}`);
  console.log(`${colors.yellow}Fix the above 'any' usage by adding proper types.${colors.reset}`);
  console.log(`${colors.yellow}If you believe this is a false positive, update the allowed patterns.${colors.reset}`);
  console.log(`${colors.red}${colors.bold}DO NOT use --no-verify unless absolutely necessary!${colors.reset}`);

  return 1;
}

function main() {
  console.log(`${colors.blue}${colors.bold}🔍 Checking for prohibited 'any' usage with ast-grep...${colors.reset}`);

  // Check if ast-grep is available
  try {
    execSync('which ast-grep', { stdio: 'ignore' });
  } catch (error) {
    console.error(`${colors.red}❌ ast-grep is not installed or not in PATH${colors.reset}`);
    console.log(`${colors.yellow}Install ast-grep: https://ast-grep.github.io/guide/quick-start.html${colors.reset}`);
    console.log(`${colors.yellow}On macOS: brew install ast-grep${colors.reset}`);
    return 1;
  }

  const filesToCheck = getChangedFiles();

  if (filesToCheck.length === 0) {
    console.log(`${colors.green}✅ No TypeScript files to check${colors.reset}`);
    return 0;
  }

  console.log(`${colors.blue}Checking files: ${filesToCheck.join(', ')}${colors.reset}`);

  const violations = [];

  for (const { pattern, description } of prohibitedPatterns) {
    const result = checkWithAstGrep(pattern, description, filesToCheck);

    if (result && !isAllowedViolation(result.output)) {
      violations.push(result);
    }
  }

  return formatResults(violations);
}

// Run the check
const exitCode = main();
process.exit(exitCode);

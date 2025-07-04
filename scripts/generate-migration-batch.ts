import { spawn } from 'child_process';

/**
 * Script to generate migration and automatically answer prompts
 */

async function generateMigration() {
  console.log('🔄 Generating Drizzle migration...');
  
  const child = spawn('pnpm', ['db:generate'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
  });

  // Auto-answer prompts with "create table" for all tables
  const answers = [
    '\n', // First selection (create table for church_gatherings)
    '\n', // Confirm
  ];

  let answerIndex = 0;
  
  // Send answers after a brief delay
  setTimeout(() => {
    if (answerIndex < answers.length) {
      child.stdin?.write(answers[answerIndex]);
      answerIndex++;
    }
  }, 1000);

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Migration generated successfully!');
    } else {
      console.log('❌ Migration generation failed');
    }
  });
}

generateMigration();
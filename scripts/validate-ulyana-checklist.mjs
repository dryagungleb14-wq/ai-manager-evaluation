#!/usr/bin/env node

/**
 * Validation script for "Для Ульяны" checklist
 * Verifies structure, scoring, and data integrity
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Validating "Для Ульяны" Checklist ===\n');

// Read and parse the built server file to extract the checklist
const distPath = join(__dirname, '..', 'dist', 'index.js');
const distContent = readFileSync(distPath, 'utf-8');

// Find the checklist data in the built file
const checklistMatch = distContent.match(/id:\s*"for-ulyana-checklist"[\s\S]*?totalScore:\s*(\d+)/);

if (!checklistMatch) {
  console.error('❌ Failed to find checklist in built file');
  process.exit(1);
}

const totalScore = parseInt(checklistMatch[1], 10);
console.log(`✓ Found checklist in built file`);
console.log(`✓ Total Score: ${totalScore}`);

// Extract stages count
const stagesPattern = /stages:\s*\[([\s\S]*?)\],\s*\}/;
const stagesMatch = distContent.match(stagesPattern);

if (!stagesMatch) {
  console.error('❌ Failed to extract stages');
  process.exit(1);
}

// Count stages by looking for "id:" patterns within stages
const stageIds = stagesMatch[1].match(/id:\s*"[^"]+"/g);
const stageCount = stageIds ? stageIds.length : 0;

console.log(`✓ Stages: ${stageCount}`);

// Expected values
const EXPECTED_TOTAL_SCORE = 13;
const EXPECTED_STAGES = 7;

// Validation
let errors = [];

if (totalScore !== EXPECTED_TOTAL_SCORE) {
  errors.push(`Total score mismatch: expected ${EXPECTED_TOTAL_SCORE}, got ${totalScore}`);
}

if (stageCount !== EXPECTED_STAGES) {
  errors.push(`Stages count mismatch: expected ${EXPECTED_STAGES}, got ${stageCount}`);
}

console.log('\n=== Validation Results ===');

if (errors.length === 0) {
  console.log('✅ All validations passed!');
  console.log('\nChecklist "Для Ульяны" is ready for use.');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev:server');
  console.log('2. Start the client: npm run dev');
  console.log('3. Open http://localhost:5173 in browser');
  console.log('4. Select "Для Ульяны" from checklist dropdown');
  console.log('5. Upload an audio file or paste transcript');
  console.log('6. Click "Проверить" to analyze');
  process.exit(0);
} else {
  console.log('❌ Validation failed:');
  errors.forEach(error => console.log(`  - ${error}`));
  process.exit(1);
}

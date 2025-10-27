#!/usr/bin/env tsx

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTests() {
  console.log('🧪 Starting limited test suite...');
  
  const startTime = Date.now();
  const maxRunTime = 5 * 60 * 1000; // 5 minutes maximum
  
  try {
    // Run tests with timeout
    const { stdout, stderr } = await execAsync('npx vitest run --reporter=verbose', {
      timeout: maxRunTime,
      cwd: process.cwd(),
    });
    
    console.log('✅ Tests completed successfully!');
    console.log(stdout);
    
    if (stderr) {
      console.warn('⚠️ Warnings:', stderr);
    }
    
  } catch (error: any) {
    if (error.code === 'TIMEOUT') {
      console.error('⏰ Tests timed out after 5 minutes');
      process.exit(1);
    } else {
      console.error('❌ Tests failed:', error.message);
      process.exit(1);
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`⏱️ Total test duration: ${duration.toFixed(2)}s`);
}

runTests().catch(console.error);
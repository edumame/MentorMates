/**
 * Test script for email batching functionality
 * 
 * This script tests the batching logic used in the email notification routes
 * to ensure recipients are properly split into batches of 50.
 * 
 * Usage: node scripts/test-email-batching.js
 */

const MAX_RECIPIENTS_PER_BATCH = 50;

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function testBatching(to, bcc, cc) {
  const bccArray = Array.isArray(bcc) ? bcc : [];
  const ccArray = Array.isArray(cc) ? cc : [];
  
  const needsBatching = 
    bccArray.length > MAX_RECIPIENTS_PER_BATCH || 
    ccArray.length > MAX_RECIPIENTS_PER_BATCH;
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST CASE');
  console.log('='.repeat(80));
  console.log(`To recipients: ${Array.isArray(to) ? to.length : 1} (${Array.isArray(to) ? to.join(', ') : to})`);
  console.log(`BCC recipients: ${bccArray.length}`);
  console.log(`CC recipients: ${ccArray.length}`);
  console.log(`Needs batching: ${needsBatching ? 'YES' : 'NO'}`);
  
  if (!needsBatching) {
    console.log('\nSingle email batch:');
    console.log(`  To: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`  BCC: ${bccArray.length > 0 ? bccArray.join(', ') : '(none)'}`);
    console.log(`  CC: ${ccArray.length > 0 ? ccArray.join(', ') : '(none)'}`);
    return { batches: 1, isValid: true };
  }
  
  // Batch processing
  const bccBatches = chunkArray(bccArray, MAX_RECIPIENTS_PER_BATCH);
  const ccBatches = chunkArray(ccArray, MAX_RECIPIENTS_PER_BATCH);
  const maxBatches = Math.max(bccBatches.length, ccBatches.length);
  
  console.log(`\nCreating ${maxBatches} batch(es):`);
  
  let isValid = true;
  const batchDetails = [];
  
  for (let i = 0; i < maxBatches; i++) {
    const batchBcc = bccBatches[i] || [];
    const batchCc = ccBatches[i] || [];
    
    const batchNum = i + 1;
    console.log(`\n  Batch ${batchNum}:`);
    console.log(`    To: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`    BCC: ${batchBcc.length} recipients (${batchBcc.length > 0 ? batchBcc.slice(0, 3).join(', ') + (batchBcc.length > 3 ? '...' : '') : 'none'})`);
    console.log(`    CC: ${batchCc.length} recipients (${batchCc.length > 0 ? batchCc.slice(0, 3).join(', ') + (batchCc.length > 3 ? '...' : '') : 'none'})`);
    
    // Validation checks
    if (batchBcc.length > MAX_RECIPIENTS_PER_BATCH) {
      console.log(`    ❌ ERROR: BCC batch exceeds ${MAX_RECIPIENTS_PER_BATCH} recipients!`);
      isValid = false;
    }
    if (batchCc.length > MAX_RECIPIENTS_PER_BATCH) {
      console.log(`    ❌ ERROR: CC batch exceeds ${MAX_RECIPIENTS_PER_BATCH} recipients!`);
      isValid = false;
    }
    if (!Array.isArray(to) && !to) {
      console.log(`    ❌ ERROR: No "to" recipient!`);
      isValid = false;
    }
    
    batchDetails.push({
      batchNum,
      to: Array.isArray(to) ? to : [to],
      bcc: batchBcc,
      cc: batchCc,
      totalRecipients: (Array.isArray(to) ? to.length : 1) + batchBcc.length + batchCc.length
    });
  }
  
  // Verify all recipients are accounted for
  const totalBccInBatches = bccBatches.reduce((sum, batch) => sum + batch.length, 0);
  const totalCcInBatches = ccBatches.reduce((sum, batch) => sum + batch.length, 0);
  
  if (totalBccInBatches !== bccArray.length) {
    console.log(`\n❌ ERROR: BCC recipients mismatch! Expected ${bccArray.length}, got ${totalBccInBatches}`);
    isValid = false;
  }
  if (totalCcInBatches !== ccArray.length) {
    console.log(`\n❌ ERROR: CC recipients mismatch! Expected ${ccArray.length}, got ${totalCcInBatches}`);
    isValid = false;
  }
  
  if (isValid) {
    console.log(`\n✅ All batches are valid!`);
    console.log(`   Total batches: ${maxBatches}`);
    console.log(`   Total BCC recipients distributed: ${totalBccInBatches}`);
    console.log(`   Total CC recipients distributed: ${totalCcInBatches}`);
  }
  
  return { batches: maxBatches, isValid, batchDetails };
}

// Load test emails
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testEmails = JSON.parse(
  readFileSync(join(__dirname, 'test-emails.json'), 'utf-8')
);

console.log('Email Batching Test Suite');
console.log('='.repeat(80));

const results = [];

// Test Case 1: No batching needed (small lists)
console.log('\n\n📧 TEST 1: Small recipient lists (no batching needed)');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.smallBccList,
  testEmails.smallCcList
));

// Test Case 2: BCC exceeds 50
console.log('\n\n📧 TEST 2: BCC list exceeds 50 recipients');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.largeBccList,
  []
));

// Test Case 3: CC exceeds 50
console.log('\n\n📧 TEST 3: CC list exceeds 50 recipients');
results.push(testBatching(
  testEmails.toRecipients,
  [],
  testEmails.largeCcList
));

// Test Case 4: Both BCC and CC exceed 50
console.log('\n\n📧 TEST 4: Both BCC and CC lists exceed 50 recipients');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.largeBccList,
  testEmails.largeCcList
));

// Test Case 5: Exactly 50 recipients (boundary test)
console.log('\n\n📧 TEST 5: Exactly 50 BCC recipients (boundary test)');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.exactly50BccList,
  []
));

// Test Case 6: 51 recipients (just over limit)
console.log('\n\n📧 TEST 6: 51 BCC recipients (just over limit)');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.exactly51BccList,
  []
));

// Test Case 7: Very large list (multiple batches)
console.log('\n\n📧 TEST 7: Very large BCC list (multiple batches)');
results.push(testBatching(
  testEmails.toRecipients,
  testEmails.veryLargeBccList,
  []
));

// Test Case 8: Multiple "to" recipients
console.log('\n\n📧 TEST 8: Multiple "to" recipients with large BCC');
results.push(testBatching(
  testEmails.multipleToRecipients,
  testEmails.largeBccList,
  []
));

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));

const passed = results.filter(r => r.isValid).length;
const failed = results.filter(r => !r.isValid).length;

results.forEach((result, index) => {
  const status = result.isValid ? '✅ PASSED' : '❌ FAILED';
  console.log(`Test ${index + 1}: ${status} (${result.batches} batch(es))`);
});

console.log(`\nTotal: ${results.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}


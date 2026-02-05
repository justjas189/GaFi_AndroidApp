/**
 * Quick script to apply the Friends system migration
 * Run this with: node scripts/apply-migration.js
 */

const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250806_friends_system_fix.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Friends System Migration');
    console.log('==========================');
    console.log('');
    console.log('To apply this migration:');
    console.log('');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Copy and paste the SQL below:');
    console.log('');
    console.log('--- BEGIN SQL MIGRATION ---');
    console.log(migrationSQL);
    console.log('--- END SQL MIGRATION ---');
    console.log('');
    console.log('5. Click "Run" to execute the migration');
    console.log('');
    console.log('This will fix the type mismatch errors in your Friends functions.');

  } catch (error) {
    console.error('Error reading migration file:', error);
  }
}

applyMigration();

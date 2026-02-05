/**
 * Apply Friends System Migration
 * This script applies the database migration to fix type mismatches in Friends functions
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// You'll need to set these environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // This needs to be the service role key

async function applyMigration() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:');
    console.error('- EXPO_PUBLIC_SUPABASE_URL');
    console.error('- SUPABASE_SERVICE_KEY (service role key needed for DDL operations)');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250806_friends_system_fix.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying Friends system migration...');
    console.log('Migration content preview:');
    console.log(migrationSQL.substring(0, 200) + '...');

    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });

        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
          // Try direct execution for DDL statements
          try {
            const { error: directError } = await supabase
              .from('_sql')
              .select('*')
              .limit(0); // This will fail but might give us a connection
            
            console.log('Attempting direct SQL execution...');
            // For now, we'll log the SQL that needs to be run manually
            console.log('Please run this SQL manually in your Supabase dashboard:');
            console.log('----');
            console.log(migrationSQL);
            console.log('----');
            return;
          } catch (directError) {
            console.error('Direct execution also failed:', directError);
          }
        } else {
          console.log(`Statement ${i + 1} executed successfully`);
        }
      }
    }

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Error applying migration:', error);
    console.log('\n=== MANUAL MIGRATION INSTRUCTIONS ===');
    console.log('Please copy and run the following SQL in your Supabase SQL Editor:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Copy and paste the SQL from:');
    console.log('   supabase/migrations/20250806_friends_system_fix.sql');
    console.log('4. Run the SQL to fix the Friends system type mismatches');
  }
}

if (require.main === module) {
  applyMigration();
}

module.exports = { applyMigration };

const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('🔍 Testing MySQL connection...\n');
    
    const configs = [
        { host: 'localhost', description: 'localhost' },
        { host: '127.0.0.1', description: '127.0.0.1 (IPv4)' },
        { host: '::1', description: '::1 (IPv6)' }
    ];
    
    for (const config of configs) {
        try {
            console.log(`Trying ${config.description}...`);
            const connection = await Promise.race([
                mysql.createConnection({
                    host: config.host,
                    user: 'root',
                    password: '',
                    port: 3306,
                    connectTimeout: 5000
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
                )
            ]);
            
            console.log(`✅ Successfully connected via ${config.description}!`);
            
            // Test query
            const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as current_db');
            console.log(`   MySQL Version: ${rows[0].version}`);
            console.log(`   Current Database: ${rows[0].current_db || '(none)'}`);
            
            await connection.end();
            return true;
        } catch (error) {
            console.log(`❌ Failed: ${error.message}\n`);
        }
    }
    
    console.log('\n⚠️  All connection attempts failed.');
    console.log('\n📝 Troubleshooting steps:');
    console.log('   1. Open XAMPP Control Panel');
    console.log('   2. Stop MySQL service');
    console.log('   3. Wait 5 seconds');
    console.log('   4. Start MySQL service again');
    console.log('   5. Run this test again: node test-mysql-connection.js');
    console.log('\n   Or check Windows Firewall settings for port 3306');
    
    return false;
}

testConnection().then(success => {
    process.exit(success ? 0 : 1);
});


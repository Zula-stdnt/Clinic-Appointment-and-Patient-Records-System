const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = http.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

const marker = 'health_' + Date.now();
const cwd = path.resolve(__dirname, '..', '..');
const routerPath = path.join(cwd, `router_${marker}.php`);

let PORT = 8088;

const routerCode = `<?php 
if ($_SERVER['REQUEST_URI'] === '/${marker}') { 
    require_once 'config/db_connect.php'; 
    echo $pdo->query('SELECT DATABASE()')->fetchColumn(); 
    exit; 
} 
return false; 
`;
fs.writeFileSync(routerPath, routerCode);

let server;

async function startServer() {
    PORT = await getFreePort();
    console.log(`Starting isolated test server on port ${PORT}...`);
    const phpExe = 'C:\\\\xampp\\\\php\\\\php.exe';
    server = spawn(phpExe, ['-S', `127.0.0.1:${PORT}`, `router_${marker}.php`], {
        cwd: cwd,
        env: { ...process.env, DB_NAME: 'hospital_db_test', DB_HOST: '127.0.0.1' }
    });
    checkHealth();
}

function checkHealth(attempt = 0) {
    if (attempt > 20) {
        console.error('Server failed to start or connect to test DB.');
        cleanup();
        process.exit(1);
    }
    http.get(`http://127.0.0.1:${PORT}/${marker}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (data === 'hospital_db_test') {
                console.log('Test server verified targeting hospital_db_test!');
                runApiTests();
            } else {
                console.error(`Wrong database or error! Got: ${data}`);
                cleanup();
                process.exit(1);
            }
        });
    }).on('error', () => {
        setTimeout(() => checkHealth(attempt + 1), 500);
    });
}

function runApiTests() {
    const testFiles = process.argv[2] ? [process.argv[2]] : [
        'tests/suites/verify_four_system_fixes.php',
        'tests/suites/verify_appointment_patient_controller.php',
        'tests/suites/verify_clinic_schedule_capacity.php',
        'tests/suites/verify_doctor_gating_sorting.php',
        'tests/suites/verify_patient_records_flow.php'
    ];
    try {
        console.log('Seeding test database before API tests...');
        execSync('C:\\xampp\\php\\php.exe tests/helpers/seed.php', {
            cwd: cwd,
            env: { ...process.env, DB_NAME: 'hospital_db_test', DB_HOST: '127.0.0.1' },
            stdio: 'inherit'
        });
        for (const testFile of testFiles) {
            console.log(`Running ${testFile}...`);
            const out = execSync(`C:\\xampp\\php\\php.exe "${testFile}" ${PORT}`, {
                cwd: cwd,
                env: { ...process.env, DB_NAME: 'hospital_db_test', DB_HOST: '127.0.0.1' },
                encoding: 'utf-8'
            });
            console.log(out);
        }
    } catch (err) {
        console.error(err.stdout || err.message);
        process.exitCode = 1;
    } finally {
        cleanup();
        process.exit();
    }
}

function cleanup() {
    if (server) {
        try { server.kill(); } catch (e) {}
    }
    if (fs.existsSync(routerPath)) {
        try { fs.unlinkSync(routerPath); } catch (e) {}
    }
}

process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });
process.on('exit', () => { cleanup(); });
process.on('uncaughtException', (err) => {
    console.error(err);
    cleanup();
    process.exit(1);
});

startServer();

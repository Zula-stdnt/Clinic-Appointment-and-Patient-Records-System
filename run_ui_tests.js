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
const cwd = __dirname;
const routerPath = path.join(cwd, `router_${marker}.php`);

let PORT = 8087;

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

let isReady = false;

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
                runPlaywright();
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

function runPlaywright() {
    console.log('Seeding test database before UI tests...');
    execSync('C:\\xampp\\php\\php.exe tests/seed.php', {
        env: { ...process.env, DB_NAME: 'hospital_db_test', DB_HOST: '127.0.0.1' },
        stdio: 'inherit'
    });
    console.log('Running UI tests...');
    process.env.PLAYWRIGHT_BASE_URL = `http://127.0.0.1:${PORT}`;
    const pw = spawn('npx.cmd', ['playwright', 'test'], {
        stdio: 'inherit',
        shell: true,
        env: process.env
    });

    pw.on('close', (code) => {
        cleanup();
        process.exit(code);
    });
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

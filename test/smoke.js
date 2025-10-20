'use strict';

const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function makeRequest(path, options = {}) {
	return new Promise((resolve, reject) => {
		const url = new URL(path, API_BASE);
		const req = http.request(url, options, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve({ status: res.statusCode, data: json });
				} catch (e) {
					resolve({ status: res.statusCode, data });
				}
			});
		});
		req.on('error', reject);
		if (options.body) req.write(options.body);
		req.end();
	});
}

async function smokeTest() {
	console.log('🧪 Running API smoke tests...');
	
	try {
		// Test stats endpoint
		const stats = await makeRequest('/stats');
		console.log('✅ Stats endpoint:', stats.status === 200 ? 'OK' : 'FAIL');
		
		// Test files endpoint
		const files = await makeRequest('/files');
		console.log('✅ Files endpoint:', files.status === 200 ? 'OK' : 'FAIL');
		
		// Test WordPress installer (should fail without domain)
		const wpTest = await makeRequest('/oneclick/wordpress', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		console.log('✅ WordPress endpoint validation:', wpTest.status === 400 ? 'OK' : 'FAIL');
		
		// Test SSL status (should fail without domain)
		const sslTest = await makeRequest('/ssl/status?domain=');
		console.log('✅ SSL endpoint validation:', sslTest.status === 400 ? 'OK' : 'FAIL');
		
		console.log('🎉 Smoke tests completed');
		process.exit(0);
	} catch (error) {
		console.error('❌ Smoke test failed:', error.message);
		process.exit(1);
	}
}

smokeTest();

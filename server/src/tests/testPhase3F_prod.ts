import http from 'http';
import { Socket } from 'net';
import { app } from '../index.js';
import { getActiveServerToken } from '../middleware/auth.js';

interface DispatchOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

interface DispatchResult {
  statusCode: number;
  headers: Record<string, any>;
  data: string;
  json: () => any;
}

function request(options: DispatchOptions): Promise<DispatchResult> {
  return new Promise((resolve, reject) => {
    try {
      const socket = new Socket();
      Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
      const req: any = new http.IncomingMessage(socket);
      req.ip = '127.0.0.1';
      req.method = options.method;
      req.url = options.url;
      req.headers = {
        host: 'localhost',
        'user-agent': 'Production-Verification-Tester',
        ...(options.headers || {})
      };

      if (options.body) {
        const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
        req.headers['content-length'] = Buffer.byteLength(bodyStr).toString();
        req.push(bodyStr);
      }
      req.push(null);

      const res = new http.ServerResponse(req);
      let responseData = '';
      const responseHeaders: Record<string, any> = {};

      const origSetHeader = res.setHeader.bind(res);
      res.setHeader = (name: string, value: any) => {
        responseHeaders[name.toLowerCase()] = value;
        return origSetHeader(name, value);
      };

      res.write = (chunk: any) => {
        responseData += chunk.toString();
        return true;
      };

      res.end = (chunk?: any): any => {
        if (chunk) responseData += chunk.toString();
        resolve({
          statusCode: res.statusCode,
          headers: { ...responseHeaders, ...res.getHeaders() },
          data: responseData,
          json: () => JSON.parse(responseData)
        });
        return res;
      };

      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runTest() {
  console.log('=== TEST F: Production Startup, Probes, Auth & Job Execution ===');

  // 1. Health Probe
  console.log('[Test F] 1. Probing GET /api/health...');
  const health = await request({ method: 'GET', url: '/api/health' });
  console.log(`[Test F] Health response (${health.statusCode}):`, health.data);
  const healthJson = health.json();
  if (health.statusCode !== 200 || healthJson.status !== 'ok') {
    throw new Error(`Health probe failed! Status: ${health.statusCode}`);
  }

  // 2. Readiness Probe
  console.log('[Test F] 2. Probing GET /api/ready...');
  const ready = await request({ method: 'GET', url: '/api/ready' });
  console.log(`[Test F] Ready response (${ready.statusCode}):`, ready.data);
  const readyJson = ready.json();
  if (ready.statusCode !== 200 || readyJson.status !== 'ready' || !readyJson.database?.includes('SQLite')) {
    throw new Error(`Readiness probe failed! Status: ${ready.statusCode}`);
  }

  // 3. Auth Token & Login
  console.log('[Test F] 3. Testing Authentication with active server token...');
  const activeToken = getActiveServerToken();
  const login = await request({
    method: 'POST',
    url: '/api/auth/login',
    body: { password: activeToken }
  });
  console.log(`[Test F] Login response (${login.statusCode}):`, login.data);
  const loginJson = login.json();
  if (login.statusCode !== 200 || !loginJson.success || !loginJson.data?.token) {
    throw new Error('Authentication login failed');
  }

  // 4. Job Submission via API
  console.log('[Test F] 4. Submitting a new job via POST /api/jobs...');
  const jobSubmit = await request({
    method: 'POST',
    url: '/api/jobs',
    headers: {
      Authorization: `Bearer ${activeToken}`
    },
    body: {
      agentId: 'seo',
      input: { url: 'https://shgtechnologies.com/' }
    }
  });
  console.log(`[Test F] Job submission response (${jobSubmit.statusCode}):`, jobSubmit.data);
  const jobSubmitJson = jobSubmit.json();
  if ((jobSubmit.statusCode !== 202 && jobSubmit.statusCode !== 201) || !jobSubmitJson.success || !jobSubmitJson.data?.jobId) {
    throw new Error(`Job submission failed! Status: ${jobSubmit.statusCode}`);
  }
  const jobId = jobSubmitJson.data.jobId;

  // 5. Job Retrieval via API
  console.log(`[Test F] 5. Retrieving job status via GET /api/jobs/${jobId}...`);
  const jobGet = await request({
    method: 'GET',
    url: `/api/jobs/${jobId}`,
    headers: {
      Authorization: `Bearer ${activeToken}`
    }
  });
  console.log(`[Test F] Job retrieval status (${jobGet.statusCode}):`, jobGet.data);
  const jobGetJson = jobGet.json();
  if (jobGet.statusCode !== 200 || !jobGetJson.success || jobGetJson.data?.jobId !== jobId) {
    throw new Error(`Job retrieval failed! Status: ${jobGet.statusCode}`);
  }

  // 6. Security Headers Verification
  console.log('[Test F] 6. Verifying Security Headers across responses...');
  const nosniff = health.headers['x-content-type-options'];
  const frameOptions = health.headers['x-frame-options'];
  console.log(`[Test F] Security headers: x-content-type-options=${nosniff}, x-frame-options=${frameOptions}`);
  if (nosniff !== 'nosniff' || !frameOptions) {
    throw new Error('Security headers missing on Express response!');
  }

  console.log('\n[Test F SUCCESS] All production endpoints, health/readiness probes, auth, and job API verified.');
  console.log('>>> TEST F PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test F Error:', err);
  process.exit(1);
});

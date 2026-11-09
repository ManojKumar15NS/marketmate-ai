$ErrorActionPreference = "Stop"

Write-Host "=========================================================="
Write-Host "TEST: REAL PROCESS KILL & INTERRUPTED JOB RECOVERY"
Write-Host "=========================================================="

# 1. Enqueue a job
$postPayload = @{
    agentId = "email_finder"
    companyId = "comp_kill_test"
    input = @{
        mode = "single_company"
        website = "https://tekaxis.com"
        keywords = @("CEO", "CTO", "Managing Director")
    }
} | ConvertTo-Json -Compress

Write-Host "`n[1] Enqueuing job..."
$jobRes = Invoke-RestMethod -Uri "http://localhost:5000/api/jobs" -Method Post -Body $postPayload -ContentType "application/json"
$jobId = $jobRes.data.jobId
Write-Host "Enqueued Job ID: $jobId, Status: $($jobRes.data.status)"

# 2. Check initial job status
$statusRes = Invoke-RestMethod -Uri "http://localhost:5000/api/jobs/$jobId" -Method Get
Write-Host "Job status before kill: $($statusRes.data.status), Progress: $($statusRes.data.progress)%"

# 3. Find Node process PID on port 5000
$targetPid = $null
$netstatLine = netstat -ano | Select-String ":5000\s.*LISTENING" | Select-Object -First 1
if ($netstatLine) {
    $targetPid = [int]($netstatLine.ToString().Trim() -split '\s+')[-1]
} else {
    $tcp = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($tcp) {
        $targetPid = $tcp.OwningProcess
    }
}

if (-not $targetPid) {
    Write-Error "Could not find listening process on port 5000."
}
$proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
Write-Host "`n[2] Found backend process on port 5000: PID $targetPid ($($proc.ProcessName))"

# 4. Hard kill process with Stop-Process -Force
Write-Host "`n[3] Executing hard kill: Stop-Process -Id $targetPid -Force..."
Stop-Process -Id $targetPid -Force
Start-Sleep -Seconds 2

# 5. Verify process is dead
$checkProc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if ($checkProc) {
    Write-Error "Process $targetPid is still running!"
} else {
    Write-Host "Process $targetPid successfully terminated. Server is DOWN."
}

# 6. Verify port 5000 is unreachable
try {
    $deadCheck = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 2
    Write-Error "Server unexpectedly responded while supposed to be down!"
} catch {
    Write-Host "Verified port 5000 is unreachable (connection refused)."
}

# 7. Restart the backend Express server
Write-Host "`n[4] Restarting backend server..."
$serverDir = "C:\Users\Manoj Kumarn N S\.gemini\antigravity\scratch\marketmate-ai\server"
$startProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden
Write-Host "Spawned new backend process with PID: $($startProc.Id)"

# 8. Wait for server to come back up
Write-Host "`n[5] Waiting for server health check..."
$restarted = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 2
        if ($health.status -eq "ok") {
            $restarted = $true
            Write-Host "Server successfully restarted and healthy after $($i + 1) seconds."
            break
        }
    } catch {
        # still booting
    }
}

if (-not $restarted) {
    Write-Error "Server failed to restart within timeout."
}

# 9. Verify job is marked as 'interrupted'
Write-Host "`n[6] Verifying job status recovery..."
$recoveredJob = Invoke-RestMethod -Uri "http://localhost:5000/api/jobs/$jobId" -Method Get
Write-Host "Job ID: $jobId"
Write-Host "Status after crash recovery: $($recoveredJob.data.status)"
Write-Host "Error message recorded: $($recoveredJob.data.error)"

if ($recoveredJob.data.status -ne "interrupted") {
    Write-Error "Expected status 'interrupted', but got '$($recoveredJob.data.status)'!"
} else {
    Write-Host "SUCCESS: Job correctly recovered with status 'interrupted'!"
}

# 10. Execute one-click Retry
Write-Host "`n[7] Testing one-click Retry endpoint: POST /api/jobs/$jobId/retry..."
$retryRes = Invoke-RestMethod -Uri "http://localhost:5000/api/jobs/$jobId/retry" -Method Post
Write-Host "Retry Response message: $($retryRes.message)"
Write-Host "Job status after retry: $($retryRes.data.status)"

if ($retryRes.data.status -eq "queued" -or $retryRes.data.status -eq "running") {
    Write-Host "SUCCESS: Job resumed execution after one-click retry!"
} else {
    Write-Error "Unexpected retry status: $($retryRes.data.status)"
}

Write-Host "`n=========================================================="
Write-Host "ALL PROCESS KILL AND RECOVERY CRITERIA MET AND PASSED!"
Write-Host "=========================================================="

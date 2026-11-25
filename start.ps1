# Start Forgotten Letters with Docker on Windows: pick a free host port, write it into .env, then
# `docker compose up -d`. The same steps and wording as start.sh.
#
#   .\start.ps1            start (or restart) the app
#   .\start.ps1 --build    any extra arguments go to `docker compose up -d`
#
# - No .env yet: it is made from .env.example with a new random database password (never printed).
# - The ports tried are PORTS in .env (default 3000,3001,3002,3003,3004,3005). A saved APP_PORT is kept while it is
#   free, or while this app's own container publishes it. Otherwise the first free port of PORTS is written to
#   APP_PORT (a bind address such as 127.0.0.1: is kept), and an http ORIGIN on the old port follows it.
# - Every port taken: a warning naming each port, exit 1, Docker not started.
# - FL_WAIT_SECONDS: how long to wait for /health/ready (default 120; 0 skips the wait).
# Nothing from .env is printed except the lines this script changes.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$DefaultPorts = '3000,3001,3002,3003,3004,3005'
$ContainerPort = 3000
$EnvPath = Join-Path $PSScriptRoot '.env'
$ExamplePath = Join-Path $PSScriptRoot '.env.example'

function Fail([string]$Message) {
	[Console]::Error.WriteLine($Message)
	exit 1
}

# The last uncommented KEY=value line of .env, without quotes; empty when unset.
function Get-EnvValue([string]$Key) {
	$value = ''
	foreach ($line in [IO.File]::ReadAllLines($EnvPath)) {
		if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.*?)\s*$") {
			$value = $Matches[1] -replace '^"(.*)"$', '$1' -replace "^'(.*)'$", '$1'
		}
	}
	return $value
}

# Set KEY=value in .env: replace every uncommented KEY= line, or append one.
function Set-EnvValue([string]$Key, [string]$Value) {
	$lines = [Collections.Generic.List[string]]::new()
	$done = $false
	foreach ($line in [IO.File]::ReadAllLines($EnvPath)) {
		if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
			$lines.Add("$Key=$Value")
			$done = $true
		} else {
			$lines.Add($line)
		}
	}
	if (-not $done) { $lines.Add("$Key=$Value") }
	[IO.File]::WriteAllText($EnvPath, (($lines -join "`n") + "`n"))
}

function New-Password {
	$bytes = [byte[]]::new(24)
	[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
	return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# 1. .env: made from .env.example with a generated database password when missing.
if (-not (Test-Path -LiteralPath $EnvPath)) {
	if (-not (Test-Path -LiteralPath $ExamplePath)) {
		Fail 'No .env and no .env.example next to start.ps1. Copy .env.example from the release.'
	}
	$password = New-Password
	$done = $false
	$out = foreach ($line in [IO.File]::ReadAllLines($ExamplePath)) {
		if (-not $done -and $line -match '^\s*POSTGRES_PASSWORD\s*=') {
			$done = $true
			"POSTGRES_PASSWORD=$password"
		} else {
			$line
		}
	}
	if (-not $done) { $out = @($out) + "POSTGRES_PASSWORD=$password" }
	[IO.File]::WriteAllText($EnvPath, ((@($out) -join "`n") + "`n"))
	Remove-Variable password
	Write-Output 'No .env yet: created it from .env.example with a new database password (not shown).'
}

# 2. The port list.
$portsRaw = Get-EnvValue 'PORTS'
if (-not $portsRaw) { $portsRaw = $DefaultPorts }
$Ports = [Collections.Generic.List[int]]::new()
foreach ($part in $portsRaw.Split(',')) {
	$p = $part.Trim()
	if (-not $p) { Fail 'PORTS: an entry is empty. Use a list like PORTS=8080,8081 in .env.' }
	if ($p -notmatch '^\d+$') { Fail "PORTS: `"$p`" is not a port number. Use a list like PORTS=8080,8081 in .env." }
	$n = [int]$p
	if ($n -lt 1 -or $n -gt 65535) { Fail "PORTS: $n is out of range (1 to 65535)." }
	if ($Ports.Contains($n)) { Fail "PORTS: $n is listed twice." }
	$Ports.Add($n)
}
$portsList = $Ports -join ', '

# 3. The saved APP_PORT, which may carry a bind address (127.0.0.1:3000): keep the address, change only the port.
$appPortRaw = Get-EnvValue 'APP_PORT'
$bind = ''
$saved = $null
if ($appPortRaw) {
	if ($appPortRaw -notmatch '^(.*:)?(\d+)$') { Fail "APP_PORT: `"$appPortRaw`" does not end in a port number." }
	$bind = [string]$Matches[1]
	$saved = [int]$Matches[2]
}
$current = if ($null -ne $saved) { $saved } else { $ContainerPort }

# Is a port in use? Returns the program holding it ('' when free).
function Get-PortHolder([int]$Port) {
	$conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
	if (-not $conn) { return '' }
	$proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
	if ($proc) { return $proc.ProcessName }
	return 'program not reported'
}

# The host port this project's own app container publishes now, or $null.
function Get-OwnPort {
	try {
		$out = & docker compose port app $ContainerPort 2>$null | Select-Object -Last 1
		if ($out -match ':(\d+)\s*$') { return [int]$Matches[1] }
	} catch { }
	return $null
}

# 4. Pick the port.
$chosen = $null
$movedFrom = $null
$firstTaken = $null
if ($null -ne $saved) {
	$holder = Get-PortHolder $saved
	if ($holder) {
		if ((Get-OwnPort) -eq $saved) {
			Write-Output "Port $saved is published by this app's own container: keeping it."
			$chosen = $saved
		} else {
			$movedFrom = $saved
			Write-Output "Checking ports $portsList"
			Write-Output "  $saved  in use ($holder), not this app"
		}
	} else {
		Write-Output "Checking port $saved (APP_PORT in .env)"
		Write-Output "  $saved  free"
		Write-Output "Using port $saved."
		$chosen = $saved
	}
}

if ($null -eq $chosen) {
	if ($null -eq $movedFrom) { Write-Output "Checking ports $portsList" }
	foreach ($p in $Ports) {
		if ($p -eq $movedFrom) { continue }
		$holder = Get-PortHolder $p
		if ($holder) {
			Write-Output "  $p  in use ($holder)"
			if ($null -eq $firstTaken) { $firstTaken = $p }
		} else {
			Write-Output "  $p  free"
			$chosen = $p
			break
		}
	}
	if ($null -eq $chosen) {
		$run = $Ports.Count -gt 1
		for ($i = 1; $i -lt $Ports.Count; $i++) { if ($Ports[$i] -ne $Ports[$i - 1] + 1) { $run = $false } }
		$range = if ($run) { "$($Ports[0])$([char]0x2013)$($Ports[$Ports.Count - 1])" } else { $portsList }
		Write-Output "Warning: ports $range are all in use. The app was not started."
		Write-Output 'Free one of them, or set other ports in .env, for example:'
		Write-Output '  PORTS=8080,8081'
		Write-Output 'Then run .\start.ps1 again.'
		exit 1
	}
	if ($null -ne $movedFrom) {
		Write-Output "The saved port $movedFrom is now used by another program, so the app moves to $chosen."
		Write-Output "Links that point to port $movedFrom (invites, bookmarks) stop working. Share the new address."
	} elseif ($null -ne $firstTaken) {
		Write-Output "$firstTaken was in use; using $chosen."
	}
}

# 5. Write what changed: APP_PORT, and an http ORIGIN whose port was the old one (or one of PORTS).
$changes = @()
if ($chosen -ne $saved) {
	Set-EnvValue 'APP_PORT' "$bind$chosen"
	$changes += "APP_PORT=$bind$chosen"
}
$origin = Get-EnvValue 'ORIGIN'
if ($origin -match '^(http://.*):(\d+)/*$') {
	$originPort = [int]$Matches[2]
	if ($originPort -ne $chosen -and ($Ports.Contains($originPort) -or $originPort -eq $current)) {
		$origin = "$($Matches[1]):$chosen"
		Set-EnvValue 'ORIGIN' $origin
		$changes += "ORIGIN=$origin"
	}
}
if ($changes.Count -gt 0) {
	if ($null -eq $saved -and $null -eq $firstTaken -and $changes.Count -eq 1) {
		Write-Output "Using port $chosen. .env: $($changes -join ', ')"
	} else {
		Write-Output "Updated .env: $($changes -join ', ')"
	}
}

# 6. Start, wait until ready, say where.
$command = ("docker compose up -d " + ($args -join ' ')).TrimEnd()
Write-Output $command
& docker compose up -d @args
if ($LASTEXITCODE -ne 0) {
	Fail 'docker compose up failed. If a port was taken in the meantime, run .\start.ps1 again.'
}

$address = if ($origin) { $origin } else { "http://localhost:$chosen" }
$waitFor = if ($env:FL_WAIT_SECONDS) { [int]$env:FL_WAIT_SECONDS } else { 120 }
if ($waitFor -gt 0) {
	$hostName = '127.0.0.1'
	if ($bind -and $bind -notin @('0.0.0.0:', '[::]:')) { $hostName = $bind.TrimEnd(':') }
	$url = "http://${hostName}:$chosen/health/ready"
	Write-Host -NoNewline 'Waiting for the app to be ready … '
	$waited = 0
	while ($true) {
		try {
			Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null
			Write-Output "ready ($waited s)"
			break
		} catch { }
		if ($waited -ge $waitFor) {
			Write-Output "not ready after $waited s."
			Fail 'See what it says: docker compose logs app'
		}
		Start-Sleep -Seconds 2
		$waited += 2
	}
}
Write-Output "Forgotten Letters runs at $address"

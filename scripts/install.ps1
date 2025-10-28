Param()

Write-Host "== Atulya Panel Windows Installer =="

function Ensure-Tool($name, $chocoPkg) {
  if (!(Get-Command $name -ErrorAction SilentlyContinue)) {
    if (!(Get-Command choco -ErrorAction SilentlyContinue) -and !(Get-Command winget -ErrorAction SilentlyContinue)) {
      Write-Error "Missing $name and no package manager (choco/winget). Install manually and rerun."
      exit 1
    }
    if (Get-Command choco -ErrorAction SilentlyContinue) {
      choco install $chocoPkg -y
    } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
      winget install --id $chocoPkg --silent --accept-package-agreements --accept-source-agreements
    }
  }
}

Ensure-Tool node 'OpenJS.NodeJS.LTS'
Ensure-Tool psql 'PostgreSQL.PostgreSQL'

Write-Host "Installing npm dependencies..."
cmd /c npm install --no-audit --no-fund
cmd /c cd backend && npm install --no-audit --no-fund
cmd /c cd frontend && npm install --no-audit --no-fund

Write-Host "Generating Prisma client and running migrations..."
cmd /c cd backend && npx prisma generate && npx prisma migrate deploy && npx prisma db seed

Write-Host "Registering Windows service..."
$nodePath = (Get-Command node).Source
$backendPath = Join-Path (Get-Location) "backend"
$entry = Join-Path $backendPath "dist/server.js"
if (!(Test-Path $entry)) { 
  Write-Host "Building backend for service..." 
  cmd /c cd backend && npm run build 
}
$bin = '"' + $nodePath + '" ' + '"' + $entry + '"'
sc.exe stop AtulyaPanel 2>$null | Out-Null
sc.exe delete AtulyaPanel 2>$null | Out-Null
sc.exe create AtulyaPanel binPath= $bin start= auto DisplayName= "Atulya Panel" | Out-Null
sc.exe description AtulyaPanel "Atulya Panel Backend Service" | Out-Null
sc.exe start AtulyaPanel | Out-Null

Write-Host "Windows install complete. Service 'AtulyaPanel' registered and started."


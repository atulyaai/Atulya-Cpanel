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

Write-Host "Windows install complete. Use 'npm run dev' or 'cpanel start' to run."


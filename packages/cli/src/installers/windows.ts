import { execa } from 'execa';

export async function installWindows() {
  // Run PowerShell installer in scripts/
  await execa('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/install.ps1'], { stdio: 'inherit' });
}


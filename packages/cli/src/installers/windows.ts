import { execa } from 'execa';

export async function installWindows() {
  // Run PowerShell installer when available
  await execa('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'install.ps1'], { stdio: 'inherit' });
}


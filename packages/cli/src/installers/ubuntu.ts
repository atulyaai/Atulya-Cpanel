import { execa } from 'execa';

export async function installUbuntuDebian() {
  await execa('bash', ['scripts/install.sh'], { stdio: 'inherit' });
}


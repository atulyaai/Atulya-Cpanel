import { execa } from 'execa';

export async function installRhel() {
  await execa('bash', ['scripts/install.sh'], { stdio: 'inherit' });
}


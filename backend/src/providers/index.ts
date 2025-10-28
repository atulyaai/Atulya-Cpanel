type ProviderName =
  | 'APIManagement'
  | 'Backup'
  | 'Cron'
  | 'Database'
  | 'DNS'
  | 'Email'
  | 'FileManager'
  | 'FTP'
  | 'LogViewer'
  | 'Monitoring'
  | 'Notification'
  | 'PHP'
  | 'PHPVersion'
  | 'ResourceMonitor'
  | 'ServiceManager'
  | 'SSL'
  | 'Subdomain'
  | 'SystemHealth'
  | 'SystemMaintenance'
  | 'System'
  | 'UserManagement'
  | 'WebSocket';

export class ProviderFactory {
  private providers = new Map<string, any>();

  async getProvider<T = any>(name: ProviderName): Promise<T> {
    if (!this.providers.has(name)) {
      const module = await import(`./${name}Provider.js`);
      const cls = (module as any)[`${name}Provider`];
      this.providers.set(name, new cls());
    }
    return this.providers.get(name);
  }
}


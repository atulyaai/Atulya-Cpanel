import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export interface DNSRecord {
  id?: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'PTR' | 'SRV';
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
  port?: number;
  target?: string;
}

export interface DNSZone {
  domain: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minimum: number;
  records: DNSRecord[];
  lastModified: Date;
}

export interface DNSProvider {
  name: string;
  type: 'powerdns' | 'bind' | 'cloudflare' | 'route53' | 'digitalocean';
  config: Record<string, any>;
}

export class DNSProvider {
  private provider: DNSProvider;
  private configPath: string;
  private zonesPath: string;

  constructor(provider: DNSProvider) {
    this.provider = provider;
    this.configPath = '/etc/powerdns/pdns.conf';
    this.zonesPath = '/etc/powerdns/zones';
  }

  /**
   * Check if DNS service is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      switch (this.provider.type) {
        case 'powerdns':
          await execAsync('which pdns_server');
          return true;
        case 'bind':
          await execAsync('which named');
          return true;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Install DNS service
   */
  async install(): Promise<void> {
    try {
      switch (this.provider.type) {
        case 'powerdns':
          await this.installPowerDNS();
          break;
        case 'bind':
          await this.installBIND();
          break;
        default:
          throw new Error(`Unsupported DNS provider: ${this.provider.type}`);
      }
    } catch (error) {
      console.error('Failed to install DNS service:', error);
      throw new Error(`Failed to install DNS service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install PowerDNS
   */
  private async installPowerDNS(): Promise<void> {
    await execAsync('apt-get update');
    await execAsync('apt-get install -y pdns-server pdns-backend-sqlite3');
    
    // Configure PowerDNS
    await this.configurePowerDNS();
    
    // Start and enable service
    await execAsync('systemctl enable pdns');
    await execAsync('systemctl start pdns');
  }

  /**
   * Install BIND
   */
  private async installBIND(): Promise<void> {
    await execAsync('apt-get update');
    await execAsync('apt-get install -y bind9 bind9utils bind9-doc');
    
    // Configure BIND
    await this.configureBIND();
    
    // Start and enable service
    await execAsync('systemctl enable bind9');
    await execAsync('systemctl start bind9');
  }

  /**
   * Configure PowerDNS
   */
  private async configurePowerDNS(): Promise<void> {
    const config = `# PowerDNS Configuration
launch=gsqlite3
gsqlite3-database=/var/lib/powerdns/pdns.db
gsqlite3-pragma-synchronous=0
gsqlite3-pragma-cache-size=16777216
gsqlite3-pragma-temp-store=2

# API Configuration
api=yes
api-key=${this.generateAPIKey()}
webserver=yes
webserver-address=127.0.0.1
webserver-port=8081
webserver-allow-from=127.0.0.1

# Logging
loglevel=4
log-dns-queries=yes
log-dns-details=yes

# Security
disable-axfr=yes
allow-axfr-ips=127.0.0.1
`;

    await fs.writeFile(this.configPath, config);
    await execAsync('mkdir -p /var/lib/powerdns');
    await execAsync('chown pdns:pdns /var/lib/powerdns');
  }

  /**
   * Configure BIND
   */
  private async configureBIND(): Promise<void> {
    const namedConf = `options {
    directory "/var/cache/bind";
    recursion yes;
    allow-recursion { localnets; };
    listen-on-v6 { any; };
    version "Not disclosed";
    allow-transfer { none; };
};

include "/etc/bind/named.conf.local";
include "/etc/bind/named.conf.default-zones";
`;

    await fs.writeFile('/etc/bind/named.conf', namedConf);
    await fs.writeFile('/etc/bind/named.conf.local', '');
  }

  /**
   * Create DNS zone
   */
  async createZone(domain: string): Promise<DNSZone> {
    try {
      const zone: DNSZone = {
        domain,
        serial: this.generateSerial(),
        refresh: 3600,
        retry: 1800,
        expire: 604800,
        minimum: 300,
        records: [
          {
            name: domain,
            type: 'NS',
            value: 'ns1.' + domain,
            ttl: 3600,
          },
          {
            name: domain,
            type: 'NS',
            value: 'ns2.' + domain,
            ttl: 3600,
          },
          {
            name: domain,
            type: 'A',
            value: '127.0.0.1',
            ttl: 3600,
          },
        ],
        lastModified: new Date(),
      };

      switch (this.provider.type) {
        case 'powerdns':
          await this.createPowerDNSZone(zone);
          break;
        case 'bind':
          await this.createBINDZone(zone);
          break;
      }

      return zone;
    } catch (error) {
      console.error('Failed to create DNS zone:', error);
      throw new Error(`Failed to create DNS zone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create PowerDNS zone
   */
  private async createPowerDNSZone(zone: DNSZone): Promise<void> {
    const zoneFile = `$ORIGIN ${zone.domain}.
$TTL ${zone.minimum}

@ IN SOA ns1.${zone.domain}. admin.${zone.domain}. (
    ${zone.serial}    ; Serial
    ${zone.refresh}   ; Refresh
    ${zone.retry}     ; Retry
    ${zone.expire}    ; Expire
    ${zone.minimum}   ; Minimum TTL
)

${zone.records.map(record => this.formatDNSRecord(record)).join('\n')}
`;

    const zonePath = path.join(this.zonesPath, `${zone.domain}.zone`);
    await fs.writeFile(zonePath, zoneFile);
    
    // Add zone to PowerDNS
    await execAsync(`pdns_control add-zone ${zone.domain}`);
  }

  /**
   * Create BIND zone
   */
  private async createBINDZone(zone: DNSZone): Promise<void> {
    const zoneFile = `$ORIGIN ${zone.domain}.
$TTL ${zone.minimum}

@ IN SOA ns1.${zone.domain}. admin.${zone.domain}. (
    ${zone.serial}    ; Serial
    ${zone.refresh}   ; Refresh
    ${zone.retry}     ; Retry
    ${zone.expire}    ; Expire
    ${zone.minimum}   ; Minimum TTL
)

${zone.records.map(record => this.formatDNSRecord(record)).join('\n')}
`;

    const zonePath = `/etc/bind/db.${zone.domain}`;
    await fs.writeFile(zonePath, zoneFile);
    
    // Add zone to BIND configuration
    const zoneConfig = `zone "${zone.domain}" {
    type master;
    file "${zonePath}";
};
`;
    
    await fs.appendFile('/etc/bind/named.conf.local', zoneConfig);
    await execAsync('systemctl reload bind9');
  }

  /**
   * Add DNS record
   */
  async addRecord(domain: string, record: DNSRecord): Promise<void> {
    try {
      const zone = await this.getZone(domain);
      if (!zone) {
        throw new Error(`Zone not found: ${domain}`);
      }

      zone.records.push(record);
      zone.serial = this.generateSerial();
      zone.lastModified = new Date();

      await this.updateZone(zone);
    } catch (error) {
      console.error('Failed to add DNS record:', error);
      throw new Error(`Failed to add DNS record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update DNS record
   */
  async updateRecord(domain: string, recordId: string, record: DNSRecord): Promise<void> {
    try {
      const zone = await this.getZone(domain);
      if (!zone) {
        throw new Error(`Zone not found: ${domain}`);
      }

      const recordIndex = zone.records.findIndex(r => r.id === recordId);
      if (recordIndex === -1) {
        throw new Error(`Record not found: ${recordId}`);
      }

      zone.records[recordIndex] = { ...record, id: recordId };
      zone.serial = this.generateSerial();
      zone.lastModified = new Date();

      await this.updateZone(zone);
    } catch (error) {
      console.error('Failed to update DNS record:', error);
      throw new Error(`Failed to update DNS record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete DNS record
   */
  async deleteRecord(domain: string, recordId: string): Promise<void> {
    try {
      const zone = await this.getZone(domain);
      if (!zone) {
        throw new Error(`Zone not found: ${domain}`);
      }

      zone.records = zone.records.filter(r => r.id !== recordId);
      zone.serial = this.generateSerial();
      zone.lastModified = new Date();

      await this.updateZone(zone);
    } catch (error) {
      console.error('Failed to delete DNS record:', error);
      throw new Error(`Failed to delete DNS record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get DNS zone
   */
  async getZone(domain: string): Promise<DNSZone | null> {
    try {
      switch (this.provider.type) {
        case 'powerdns':
          return await this.getPowerDNSZone(domain);
        case 'bind':
          return await this.getBINDZone(domain);
        default:
          return null;
      }
    } catch (error) {
      console.error('Failed to get DNS zone:', error);
      return null;
    }
  }

  /**
   * Get PowerDNS zone
   */
  private async getPowerDNSZone(domain: string): Promise<DNSZone | null> {
    try {
      const zonePath = path.join(this.zonesPath, `${domain}.zone`);
      if (!await fs.pathExists(zonePath)) {
        return null;
      }

      const content = await fs.readFile(zonePath, 'utf8');
      return this.parseZoneFile(content, domain);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get BIND zone
   */
  private async getBINDZone(domain: string): Promise<DNSZone | null> {
    try {
      const zonePath = `/etc/bind/db.${domain}`;
      if (!await fs.pathExists(zonePath)) {
        return null;
      }

      const content = await fs.readFile(zonePath, 'utf8');
      return this.parseZoneFile(content, domain);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update zone
   */
  private async updateZone(zone: DNSZone): Promise<void> {
    switch (this.provider.type) {
      case 'powerdns':
        await this.updatePowerDNSZone(zone);
        break;
      case 'bind':
        await this.updateBINDZone(zone);
        break;
    }
  }

  /**
   * Update PowerDNS zone
   */
  private async updatePowerDNSZone(zone: DNSZone): Promise<void> {
    const zoneFile = `$ORIGIN ${zone.domain}.
$TTL ${zone.minimum}

@ IN SOA ns1.${zone.domain}. admin.${zone.domain}. (
    ${zone.serial}    ; Serial
    ${zone.refresh}   ; Refresh
    ${zone.retry}     ; Retry
    ${zone.expire}    ; Expire
    ${zone.minimum}   ; Minimum TTL
)

${zone.records.map(record => this.formatDNSRecord(record)).join('\n')}
`;

    const zonePath = path.join(this.zonesPath, `${zone.domain}.zone`);
    await fs.writeFile(zonePath, zoneFile);
    await execAsync(`pdns_control reload ${zone.domain}`);
  }

  /**
   * Update BIND zone
   */
  private async updateBINDZone(zone: DNSZone): Promise<void> {
    const zoneFile = `$ORIGIN ${zone.domain}.
$TTL ${zone.minimum}

@ IN SOA ns1.${zone.domain}. admin.${zone.domain}. (
    ${zone.serial}    ; Serial
    ${zone.refresh}   ; Refresh
    ${zone.retry}     ; Retry
    ${zone.expire}    ; Expire
    ${zone.minimum}   ; Minimum TTL
)

${zone.records.map(record => this.formatDNSRecord(record)).join('\n')}
`;

    const zonePath = `/etc/bind/db.${zone.domain}`;
    await fs.writeFile(zonePath, zoneFile);
    await execAsync('systemctl reload bind9');
  }

  /**
   * Parse zone file
   */
  private parseZoneFile(content: string, domain: string): DNSZone {
    const lines = content.split('\n');
    const records: DNSRecord[] = [];
    
    let serial = 1;
    let refresh = 3600;
    let retry = 1800;
    let expire = 604800;
    let minimum = 300;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(';') || !trimmed) continue;

      if (trimmed.includes('IN SOA')) {
        const soaMatch = trimmed.match(/IN SOA.*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+)/);
        if (soaMatch) {
          serial = parseInt(soaMatch[1]);
          refresh = parseInt(soaMatch[2]);
          retry = parseInt(soaMatch[3]);
          expire = parseInt(soaMatch[4]);
          minimum = parseInt(soaMatch[5]);
        }
      } else if (trimmed.includes('IN A') || trimmed.includes('IN AAAA') || 
                 trimmed.includes('IN CNAME') || trimmed.includes('IN MX') || 
                 trimmed.includes('IN TXT') || trimmed.includes('IN NS')) {
        const record = this.parseDNSRecord(trimmed);
        if (record) {
          records.push(record);
        }
      }
    }

    return {
      domain,
      serial,
      refresh,
      retry,
      expire,
      minimum,
      records,
      lastModified: new Date(),
    };
  }

  /**
   * Parse DNS record from line
   */
  private parseDNSRecord(line: string): DNSRecord | null {
    const parts = line.split(/\s+/);
    if (parts.length < 4) return null;

    const name = parts[0] === '@' ? '' : parts[0];
    const type = parts[2] as DNSRecord['type'];
    const value = parts[3];
    const ttl = parseInt(parts[1]) || 3600;

    return {
      name,
      type,
      value,
      ttl,
    };
  }

  /**
   * Format DNS record
   */
  private formatDNSRecord(record: DNSRecord): string {
    const name = record.name || '@';
    const ttl = record.ttl || 3600;
    const type = record.type;
    const value = record.value;

    if (type === 'MX') {
      const priority = record.priority || 10;
      return `${name} ${ttl} IN ${type} ${priority} ${value}`;
    } else if (type === 'SRV') {
      const priority = record.priority || 0;
      const weight = record.weight || 0;
      const port = record.port || 0;
      return `${name} ${ttl} IN ${type} ${priority} ${weight} ${port} ${value}`;
    } else {
      return `${name} ${ttl} IN ${type} ${value}`;
    }
  }

  /**
   * Generate serial number
   */
  private generateSerial(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Generate API key
   */
  private generateAPIKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  /**
   * Get DNS service status
   */
  async getStatus(): Promise<{
    running: boolean;
    active: boolean;
    uptime: string;
    queries: number;
  }> {
    try {
      let serviceName = '';
      switch (this.provider.type) {
        case 'powerdns':
          serviceName = 'pdns';
          break;
        case 'bind':
          serviceName = 'bind9';
          break;
        default:
          return { running: false, active: false, uptime: '0', queries: 0 };
      }

      const { stdout: isActive } = await execAsync(`systemctl is-active ${serviceName}`);
      const isRunning = isActive.trim() === 'active';

      let uptime = '0';
      let queries = 0;

      if (isRunning) {
        const { stdout: statusOutput } = await execAsync(`systemctl status ${serviceName} --no-pager`);
        const uptimeMatch = statusOutput.match(/Active: active \\(running\\) since (.+?);/);
        uptime = uptimeMatch ? uptimeMatch[1] : 'Unknown';

        // Count queries (simplified)
        queries = Math.floor(Math.random() * 1000); // Placeholder
      }

      return {
        running: isRunning,
        active: isRunning,
        uptime,
        queries,
      };
    } catch (error) {
      return {
        running: false,
        active: false,
        uptime: '0',
        queries: 0,
      };
    }
  }
}
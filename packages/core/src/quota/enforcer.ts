export interface Quota {
  diskMB: number;
  bandwidthGB: number;
}

export function enforceQuota<T extends { userId: string }>(handler: (req: any) => Promise<any>) {
  return async (req: any) => {
    // TODO: lookup user quota usage; stub allows all
    return handler(req);
  };
}


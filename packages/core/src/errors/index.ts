export class ProviderError extends Error {
  public context?: Record<string, any>;
  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'ProviderError';
    this.context = context;
  }
}

export class ValidationError extends Error {
  public details?: any;
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function handleErrors(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    try {
      return await original.apply(this, args);
    } catch (err: any) {
      throw new ProviderError(err?.message || 'Unknown provider error', {
        provider: target.constructor.name,
        method: key
      });
    }
  };
  return descriptor;
}


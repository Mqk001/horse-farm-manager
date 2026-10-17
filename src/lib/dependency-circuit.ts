export class DependencyUnavailableError extends Error {
  constructor(readonly dependency: string, readonly reason: 'open' | 'busy' | 'timeout') {
    super(`${dependency} is temporarily unavailable (${reason}).`);
    this.name = 'DependencyUnavailableError';
  }
}

type Options = { name: string; timeoutMs: number; maxConcurrent: number; failureThreshold: number; cooldownMs: number; isFailure?: (error: unknown) => boolean; now?: () => number };

// Per warm server instance. No pending queue and no automatic retries.
export class DependencyCircuit {
  private active = 0;
  private failures = 0;
  private openedAt: number | null = null;
  private probe = false;
  private generation = 0;
  constructor(private readonly options: Options) {
    for (const value of [options.timeoutMs, options.maxConcurrent, options.failureThreshold, options.cooldownMs]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid dependency circuit configuration');
    }
  }
  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const o = this.options;
    const now = o.now ?? Date.now;
    const recovering = this.openedAt !== null;
    if (recovering && (now() - this.openedAt! < o.cooldownMs || this.probe)) throw new DependencyUnavailableError(o.name, 'open');
    if (this.active >= o.maxConcurrent) throw new DependencyUnavailableError(o.name, 'busy');
    if (recovering) this.probe = true;
    const generation = this.generation;
    this.active++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Hold the slot until the actual transport settles, even if it ignores abort.
    const work = Promise.resolve().then(() => operation(controller.signal));
    void work.then(() => { this.active--; }, () => { this.active--; });
    try {
      const result = await Promise.race([work, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new DependencyUnavailableError(o.name, 'timeout'));
          controller.abort();
        }, o.timeoutMs);
      })]);
      if (generation === this.generation) { this.failures = 0; this.openedAt = null; }
      return result;
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof DependencyUnavailableError || (o.isFailure?.(error) ?? true)) {
          this.failures++;
          if (recovering || this.failures >= o.failureThreshold) {
            this.openedAt = now();
            this.generation++; // Older concurrent completions cannot close this circuit.
          }
        } else {
          // A valid provider response rejecting user input proves availability.
          this.failures = 0;
          this.openedAt = null;
        }
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (recovering) this.probe = false;
    }
  }
}

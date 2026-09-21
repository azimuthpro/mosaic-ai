/**
 * Minimal ambient declaration for the `bun:test` module used by `bun run test`.
 *
 * Declared locally rather than depending on `@types/bun`: that package's global
 * types displace the DOM/Node globals this Next.js app is typed against, which
 * makes unrelated Supabase query generics fail to resolve.
 */
declare module "bun:test" {
  export function describe(label: string, fn: () => void): void;
  export function it(label: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;

  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeNull(): void;
    toThrow(expected?: string | RegExp): void;
  }

  export function expect(actual: unknown): Matchers & {
    not: Matchers;
    rejects: { toThrow(expected?: string | RegExp): Promise<void> };
  };
}

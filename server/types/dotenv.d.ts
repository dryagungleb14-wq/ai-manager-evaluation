declare module "dotenv" {
  interface DotenvConfigOptions {
    path?: string;
    encoding?: string;
  }

  interface DotenvConfigOutput {
    parsed?: Record<string, string>;
    error?: Error;
  }

  export function config(options?: DotenvConfigOptions): DotenvConfigOutput;
  export default { config };
}

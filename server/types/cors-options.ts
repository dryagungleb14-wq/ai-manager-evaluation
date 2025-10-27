import type { RequestHandler } from "express";

type OriginFunction = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;

type OriginSetting = string | RegExp | Array<string | RegExp> | OriginFunction;

export interface CorsOptions {
  origin?: OriginSetting;
  credentials?: boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export type CorsFactory = (options?: CorsOptions) => RequestHandler;

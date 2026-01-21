declare module 'onnxruntime-web' {
  export interface Tensor {
    data: Float32Array | BigInt64Array | Int32Array | Uint8Array;
    dims: readonly number[];
    type: string;
  }

  export class Tensor {
    constructor(
      type: string,
      data: Float32Array | BigInt64Array | Int32Array | Uint8Array | number[],
      dims?: readonly number[]
    );
    data: Float32Array | BigInt64Array | Int32Array | Uint8Array;
    dims: readonly number[];
    type: string;
  }

  export interface InferenceSessionRunOptions {
    logSeverityLevel?: number;
  }

  export interface SessionOptions {
    executionProviders?: string[];
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
    enableCpuMemArena?: boolean;
    enableMemPattern?: boolean;
    executionMode?: 'sequential' | 'parallel';
    logSeverityLevel?: number;
    logVerbosityLevel?: number;
  }

  export interface InferenceSession {
    run(
      feeds: Record<string, Tensor>,
      options?: InferenceSessionRunOptions
    ): Promise<Record<string, Tensor>>;
    release(): Promise<void>;
    inputNames: readonly string[];
    outputNames: readonly string[];
  }

  export namespace InferenceSession {
    function create(
      path: string,
      options?: SessionOptions
    ): Promise<InferenceSession>;

    type SessionOptions = {
      executionProviders?: string[];
      graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
    };
  }
}

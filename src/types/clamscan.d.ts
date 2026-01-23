/**
 * Type declaration for optional clamscan module.
 * This is an optional dependency - only install when ENABLE_MALWARE_SCAN=true.
 *
 * Install with: npm install clamscan
 */
declare module 'clamscan' {
  interface ClamScanOptions {
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
      localFallback?: boolean;
    };
    preference?: 'clamdscan' | 'clamscan';
  }

  interface ScanResult {
    isInfected: boolean;
    viruses?: string[];
    file?: string;
  }

  class NodeClam {
    init(options: ClamScanOptions): Promise<NodeClam>;
    scanBuffer(buffer: Buffer): Promise<ScanResult>;
    scanFile(filePath: string): Promise<ScanResult>;
  }

  export default NodeClam;
}

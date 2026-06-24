export type Screen = 'setup' | 'crawl' | 'results';
export type Method = 'filename' | 'pixel' | 'hash';

export interface SearchSummary {
  domain: string;
  method: Method;
  threshold: number;
  referenceFilename: string;
}

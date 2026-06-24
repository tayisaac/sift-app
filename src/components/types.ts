export type Screen = 'setup' | 'crawl' | 'results';
export type Method = 'filename' | 'pixel';

export interface SearchSummary {
  domain: string;
  method: Method;
  threshold: number;
  referenceFilename: string;
}

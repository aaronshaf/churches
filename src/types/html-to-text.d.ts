declare module 'html-to-text' {
  export interface HtmlToTextOptions {
    wordwrap?: number | false;
    selectors?: Array<{
      selector: string;
      options?: {
        uppercase?: boolean;
        trimEmptyLines?: boolean;
      };
    }>;
    limits?: {
      maxInputLength?: number;
    };
  }

  export function convert(html: string, options?: HtmlToTextOptions): string;
}
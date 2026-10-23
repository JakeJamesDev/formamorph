import type { Processor } from 'unified';
import type { Extension } from 'micromark-util-types';

/**
 * Remark plugin that turns off CommonMark's indented code blocks, so text indented by four spaces reads as
 * ordinary paragraphs and lists. Models indent their prose and their reasoning outlines often and mean code
 * almost never; fenced code is unaffected.
 */
export function remarkNoIndentedCode(this: Processor): void {
  const data = this.data() as { micromarkExtensions?: Extension[] };
  (data.micromarkExtensions ??= []).push({ disable: { null: ['codeIndented'] } });
}

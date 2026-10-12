import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

// Extend the default sanitize schema to allow iframes and video elements
const iframeSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'iframe', 'video', 'source'],
  attributes: {
    ...defaultSchema.attributes,
    iframe: [
      'src',
      'allow',
      'allowfullscreen',
      'frameborder',
      'height',
      'width',
      'loading',
      'referrerpolicy',
      'sandbox',
      'title',
      'className',
      'class',
    ],
    video: [
      'src',
      'controls',
      'autoplay',
      'muted',
      'loop',
      'playsinline',
      'poster',
      'preload',
      'width',
      'height',
      'className',
      'class',
      'style',
    ],
    source: ['src', 'type'],
  },
};

// Reusable list of rehype plugins for ReactMarkdown
export const markdownRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, iframeSanitizeSchema],
];

// Reusable list of remark plugins for ReactMarkdown.
// remark-gfm enables GFM tables, strikethrough, task lists, and autolinks.
export const markdownRemarkPlugins: PluggableList = [remarkGfm];

export { iframeSanitizeSchema };
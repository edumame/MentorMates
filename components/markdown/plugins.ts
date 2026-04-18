import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
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

export { iframeSanitizeSchema };
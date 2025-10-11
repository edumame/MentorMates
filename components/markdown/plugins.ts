import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { PluggableList } from 'unified';

// Extend the default sanitize schema to allow iframes with safe attributes
const iframeSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'iframe'],
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
  },
};

// Reusable list of rehype plugins for ReactMarkdown
export const markdownRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, iframeSanitizeSchema],
];

export { iframeSanitizeSchema };
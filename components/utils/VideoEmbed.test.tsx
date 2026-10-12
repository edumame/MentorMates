import { fireEvent, render, screen } from '@testing-library/react';
import { VideoEmbed, getEmbedDescriptor, getEmbedUrl } from './VideoEmbed';
it.each([
 ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
 ['https://vimeo.com/12345', 'https://player.vimeo.com/video/12345'],
 ['https://www.loom.com/share/abc123', 'https://www.loom.com/embed/abc123'],
])('converts a provider URL %s', (url, src) => { expect(getEmbedDescriptor(url)).toEqual({ src, kind: 'iframe' }); });
it.each(['javascript:alert(1)', 'not a URL', 'https://evil.test/?next=player.vimeo.com/video/123', 'https://youtube.com.evil.test/embed/dQw4w9WgXcQ'])('rejects unsafe or spoofed embeds: %s', url => { expect(getEmbedDescriptor(url)).toBeNull(); });
it('renders direct media with controls and reports playback errors', () => {
 const error = jest.fn(); const url='https://cdn.example.test/demo.mp4?token=123';
 expect(getEmbedUrl(url)).toBeNull(); render(<VideoEmbed url={url} title="Demo" onLoadError={error} />);
 const video=screen.getByTitle('Demo'); expect(video.tagName).toBe('VIDEO'); expect(video).toHaveAttribute('controls'); fireEvent.error(video); expect(error).toHaveBeenCalledTimes(1);
});
it('provides a fallback for web links but suppresses unsafe links and disabled fallbacks', () => {
 const { rerender }=render(<VideoEmbed url="https://example.test/demo" />); expect(screen.getByRole('link')).toHaveAttribute('href','https://example.test/demo');
 rerender(<VideoEmbed url="javascript:alert(1)" />); expect(screen.queryByRole('link')).toBeNull();
 rerender(<VideoEmbed url="https://example.test/demo" fallback={false} />); expect(screen.queryByRole('link')).toBeNull();
});
it('reports iframe loading errors', () => {
 const error=jest.fn(); render(<VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" onLoadError={error} />); fireEvent.error(screen.getByTitle('Video')); expect(error).toHaveBeenCalledTimes(1);
});

import { projectBackTarget } from './back-navigation';
it.each([true,false])('returns judges to the gallery regardless of unrelated browser history (%s)', history => {
 expect(projectBackTarget('event',true,history)).toBe('/events/event/gallery?view=judge');
});
it('preserves ordinary visitor back navigation', () => { expect(projectBackTarget('event',false,true)).toBeNull(); });
it('falls back to overview or projects for direct links', () => {
 expect(projectBackTarget('event',false,false)).toBe('/events/event/overview'); expect(projectBackTarget(null,false,false)).toBe('/projects');
});

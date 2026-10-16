import { act, render } from '@testing-library/react';
import { HighFiveConnect } from './HighFiveConnect';
const mockControls = { start: jest.fn(), stop: jest.fn() };
const mockPlay = jest.fn();
jest.mock('framer-motion', () => ({ useAnimation: () => mockControls, motion: { div: 'div', p: 'p' } }));
jest.mock('./use-clap-sound', () => ({ useClapSound: () => ({ playHighFive: mockPlay }) }));
jest.mock('./CartoonHand', () => ({ CartoonHand: () => null }));
jest.mock('./SparkBurst', () => ({ SparkBurst: () => null }));
jest.mock('./ImpactFlash', () => ({ ImpactFlash: () => null, ImpactLines: () => null }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockControls.start.mockResolvedValue(undefined); });
afterEach(() => { jest.useRealTimers(); });
it('completes once after the animation', async () => {
 const done=jest.fn(); await act(async () => { render(<HighFiveConnect teamName="Team" onComplete={done} />); });
 act(() => { jest.advanceTimersByTime(1100); }); expect(done).toHaveBeenCalledTimes(1);
});
it('cancels completion when unmounted after animation', async () => {
 const done=jest.fn(); let view: ReturnType<typeof render>;
 await act(async () => { view=render(<HighFiveConnect teamName="Team" onComplete={done} />); });
 view!.unmount(); act(() => { jest.runAllTimers(); }); expect(done).not.toHaveBeenCalled(); expect(mockControls.stop).toHaveBeenCalled();
});
it('ignores an animation that finishes after unmount', async () => {
 let finish!: () => void; mockControls.start.mockReturnValue(new Promise<void>(resolve => { finish=resolve; }));
 const done=jest.fn(); const view=render(<HighFiveConnect teamName="Team" onComplete={done} />); view.unmount();
 await act(async () => { finish(); }); act(() => { jest.runAllTimers(); }); expect(done).not.toHaveBeenCalled(); expect(mockPlay).not.toHaveBeenCalled();
});

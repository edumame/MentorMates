import { fireEvent, render, screen } from '@testing-library/react';
import { needsSoloConfirmation, SoloSubmissionConfirmation } from './SoloSubmissionConfirmation';
it.each([
 [[], [{email:'person@example.test'}], true],
 [['PERSON@example.test'], [{email:'person@example.test'}], false],
 [['outside@example.test'], [{email:'person@example.test'}], true],
 [[], [], false],
])('checks membership before asking for solo confirmation', (teammates, participants, expected) => {
 expect(needsSoloConfirmation(teammates as string[], participants as {email:string}[])).toBe(expected);
});
it('cancels without submitting so teammates can be added', () => {
 const confirm=jest.fn(), change=jest.fn(); render(<SoloSubmissionConfirmation open onOpenChange={change} onConfirm={confirm} />);
 fireEvent.click(screen.getByRole('button', {name:'Add teammates'})); expect(confirm).not.toHaveBeenCalled(); expect(change).toHaveBeenCalledWith(false);
});
it('publishes only after explicit solo confirmation', () => {
 const confirm=jest.fn(); render(<SoloSubmissionConfirmation open onOpenChange={() => {}} onConfirm={confirm} />);
 expect(confirm).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', {name:'Submit solo'})); expect(confirm).toHaveBeenCalledTimes(1);
});

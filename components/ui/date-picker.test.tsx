import { fireEvent, render, screen } from '@testing-library/react';
import { DatePicker } from './date-picker';
jest.mock('@/components/ui/popover',()=>({
 Popover:({children}:{children:React.ReactNode})=><>{children}</>,
 PopoverTrigger:({children}:{children:React.ReactNode})=><>{children}</>,
 PopoverContent:({children}:{children:React.ReactNode})=><>{children}</>,
}));
jest.mock('@/components/ui/calendar',()=>({Calendar:({onSelect}:{onSelect:(date:Date)=>void})=><button onClick={()=>onSelect(new Date(2026,11,2))}>Pick December 2</button>}));
it.each(['2026-12-01','2026-12-01T00:00:00Z','2026-12-01T00:00:00+00:00'])('preserves calendar date from %s',value=>{
 render(<DatePicker value={value}/>);
 expect(screen.getByPlaceholderText('mm/dd/yyyy')).toHaveValue('12/01/2026');
});
it('tracks updated controlled values and emits date-only values',()=>{
 const change=jest.fn();const{rerender}=render(<DatePicker value="2026-12-01" onChange={change}/>);
 fireEvent.click(screen.getByText('Pick December 2'));
 expect(change).toHaveBeenCalledWith('2026-12-02');
 rerender(<DatePicker value="2026-12-02" onChange={change}/>);
 expect(screen.getByPlaceholderText('mm/dd/yyyy')).toHaveValue('12/02/2026');
});
it('does not reinterpret a non-midnight timestamp as a calendar-date encoding',()=>{
 const value='2026-12-01T18:30:00Z';const date=new Date(value);
 render(<DatePicker value={value}/>);
 expect(screen.getByPlaceholderText('mm/dd/yyyy')).toHaveValue(`${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}/${date.getFullYear()}`);
});
it('keeps invalid dates empty and disabled pickers immutable',()=>{
 const change=jest.fn();render(<DatePicker value="2026-02-31" disabled onChange={change}/>);
 expect(screen.getByPlaceholderText('mm/dd/yyyy')).toHaveValue('');
 expect(screen.getByPlaceholderText('mm/dd/yyyy')).toBeDisabled();
 fireEvent.click(screen.getByText('Pick December 2'));
 expect(change).not.toHaveBeenCalled();
});

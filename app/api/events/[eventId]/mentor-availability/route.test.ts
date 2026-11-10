/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
const mockFrom=jest.fn();const mockServiceFrom=jest.fn();
jest.mock('@/app/utils/supabase/server',()=>({createSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'viewer'}},error:null})},from:mockFrom})}));
jest.mock('@/lib/supabase/service',()=>({createSupabaseServiceClient:()=>({from:mockServiceFrom})}));
function query(data:unknown){const q:Record<string,unknown>={};for(const method of ['select','eq','in','order','is'])q[method]=()=>q;q.maybeSingle=async()=>({data,error:null});q.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve);return q;}
function fixtures(role:string,mentor='other') {mockFrom.mockReturnValue(query({role}));mockServiceFrom.mockImplementation((table:string)=>query(table==='mentor_availability'?[{id:'slot-a',mentor_id:mentor},{id:'slot-b',mentor_id:mentor}]:table==='mentor_bookings'?[{id:'booking',availability_id:'slot-a',participant_id:'attendee',status:'confirmed'}]:[{uid:'attendee',display_name:'Attendee',email:'attendee@example.invalid'}]));}
const context={params:Promise.resolve({eventId:'event'})};
beforeEach(()=>{mockFrom.mockReset();mockServiceFrom.mockReset();});
it('returns counts but no other attendees to an ordinary participant',async()=>{fixtures('participant');const response=await GET(new NextRequest('http://localhost/availability'),context);const {availability}=await response.json();expect(availability[0]).toMatchObject({booking_count:1,participants:[]});expect(availability[1].participants).toEqual([]);expect(mockServiceFrom.mock.calls.filter(([table])=>table==='user_profiles')).toHaveLength(1);});
it.each([['organizer','other'],['mentor','viewer']])('scopes authorized %s attendee details to the correct slot',async(role,mentor)=>{fixtures(role,mentor);const {availability}=await (await GET(new NextRequest('http://localhost/availability'),context)).json();expect(availability[0].participants).toEqual([{display_name:'Attendee',email:'attendee@example.invalid',booking_id:'booking'}]);expect(availability[1].participants).toEqual([]);});

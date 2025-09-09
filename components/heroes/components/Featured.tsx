"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

interface FeaturedEvent {
    id: string;
    title: string;
    description: string;
    date: string;
    location: string;
    attendees: number;
    category: string;
    image: string;
}

export function Featured() {
    const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFeaturedEvents = async () => {
        try {
            const supabase = createClient();
            
            // Fetch events from the database
            const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(3);

            if (error) {
            throw error;
            }

            // Transform the data to match our interface
            const transformedEvents: FeaturedEvent[] = events?.map(event => ({
            id: event.id,
            title: event.title || 'Untitled Event',
            description: event.description || 'No description available',
            date: event.date ? new Date(event.date).toLocaleDateString('en-US', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            }) : 'TBD',
            location: event.location || 'Online',
            attendees: event.attendees_count || 0,
            category: event.category || 'General',
            image: event.image_url || '/api/placeholder/300/200'
            })) || [];

            setFeaturedEvents(transformedEvents);
        } catch (err) {
            console.error('Error fetching featured events:', err);
            setError('Failed to load featured events');
            
            // Fallback to mock data if database fetch fails
            const fallbackEvents: FeaturedEvent[] = [
            {
                id: '1',
                title: 'Innovative Together',
                description: 'Join our Space Race sprint, commemorating the Apollo mission with an event in honor of human achievement.',
                date: '09 May 2024',
                location: 'Online',
                attendees: 45,
                category: 'Innovation',
                image: '/api/placeholder/300/200'
            },
            {
                id: '2',
                title: 'Demo Night',
                description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum.',
                date: '10 May 2024',
                location: 'Austin',
                attendees: 120,
                category: 'Networking',
                image: '/api/placeholder/300/200'
            },
            {
                id: '3',
                title: 'Pitch Your Ideas',
                description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum.',
                date: '11 May 2024',
                location: 'Online',
                attendees: 85,
                category: 'Pitching',
                image: '/api/placeholder/300/200'
            }
            ];
            setFeaturedEvents(fallbackEvents);
        } finally {
            setLoading(false);
        }
        };

        fetchFeaturedEvents();
    }, []);

    if (loading) {
        return (
        <section className="py-16 px-4 md:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Featured Events
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Loading amazing events...
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {[...Array(3)].map((_, index) => (
                <Card key={index} className="overflow-hidden bg-white dark:bg-gray-800 animate-pulse">
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-700" />
                    <CardHeader className="pb-3">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </CardHeader>
                    <CardContent className="pt-0">
                    <div className="space-y-2 mb-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                    </CardContent>
                </Card>
                ))}
            </div>
            </div>
        </section>
        );
    }

    return (
        <section className="max-w-7xl mx-auto py-16 px-4 md:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Featured Events
            </h2>
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {error} - Showing sample events
                </p>
            )}
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {featuredEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white dark:bg-gray-800">
                <div className="relative">
                    <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-48 object-cover"
                    />
                    <Badge 
                    variant="secondary" 
                    className="absolute top-3 left-3 bg-white/90 text-gray-800"
                    >
                    {event.category}
                    </Badge>
                </div>
                
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                    {event.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300 line-clamp-2">
                    {event.description}
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                    <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {event.date}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="w-4 h-4 mr-2" />
                        {event.location}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Users className="w-4 h-4 mr-2" />
                        {event.attendees} attendees
                    </div>
                    </div>
                    
                    <Button variant="outline" className="w-full">
                    View Event
                    </Button>
                </CardContent>
                </Card>
            ))}
            </div>

            {/* View All Button */}
            <div className="text-center">
            <Button size="lg" className="px-8">
                View All Events
            </Button>
            </div>
        </div>
        </section>
    );
};
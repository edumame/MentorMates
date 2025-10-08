"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { PostPaymentJoin } from './post-payment-join';
import { LoadingScreen } from '@/components/ui/loading-screen';
import Link from 'next/link';

interface PaymentStatusWatcherProps {
  sessionId: string;
  eventId?: string;
  customerEmail?: string | null;
}

type PaymentStatus = 'processing' | 'paid' | 'canceled';

interface UserEventPayment {
  id: string;
  user_id: string;
  event_id: string;
  payment_status: PaymentStatus;
  stripe_session_id: string;
  created_at: string;
  updated_at: string;
}

export function PaymentStatusWatcher({ sessionId, eventId, customerEmail }: PaymentStatusWatcherProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('processing');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let processingTimer: NodeJS.Timeout | null = null;

    const setupRealtimeSubscription = async () => {
      try {
        // First, fetch the current payment record
        const { data: payment, error: fetchError } = await supabase
          .from('user_event_payments')
          .select('*')
          .eq('stripe_session_id', sessionId)
          .single();

        if (fetchError) {
          setError('Failed to fetch payment status');
          setIsLoading(false);
          
          // Retry after 3 seconds if we haven't exceeded retry limit
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              setRemountKey(prev => prev + 1);
              setError(null);
              setIsLoading(true);
            }, 3000);
          }
          return;
        }

        if (payment) {
          setPaymentStatus(payment.payment_status);
          setIsLoading(false);

          // If payment is still processing, set up a 3-second timer to check again
          if (payment.payment_status === 'processing') {
            processingTimer = setTimeout(() => {
              setRemountKey(prev => prev + 1);
            }, 3000);
          }

          // Set up real-time subscription to watch for changes
          subscription = supabase
            .channel('payment-status-changes')
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'user_event_payments',
                filter: `id=eq.${payment.id}`,
              },
              (payload: { new: UserEventPayment }) => {
                const updatedPayment = payload.new;
                setPaymentStatus(updatedPayment.payment_status);
                
                // Clear the processing timer if payment status changes
                if (processingTimer) {
                  clearTimeout(processingTimer);
                  processingTimer = null;
                }
              }
            )
            .subscribe();
        } else {
          setError('Payment record not found');
          setIsLoading(false);
          
          // Retry after 3 seconds if we haven't exceeded retry limit
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              setRemountKey(prev => prev + 1);
              setError(null);
              setIsLoading(true);
            }, 3000);
          }
        }
      } catch (err) {
        console.error('Error setting up payment watcher:', err);
        setError(`Failed to initialize payment watcher.`);
        setIsLoading(false);
        
        // Retry after 3 seconds if we haven't exceeded retry limit
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setRemountKey(prev => prev + 1);
            setError(null);
            setIsLoading(true);
          }, 3000);
        }
      }
    };

    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      if (processingTimer) {
        clearTimeout(processingTimer);
      }
    };
  }, [sessionId, remountKey, retryCount]); // Include remountKey in dependencies to trigger remount

  // Show loading state while fetching payment record
  if (isLoading) {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <LoadingScreen />
          <p className="text-gray-600 mt-4">
            Processing your payment...
            {retryCount > 0 && (
              <span className="block text-sm text-gray-500 mt-2">
                Retry attempt {retryCount}/3
              </span>
            )}
          </p>
        </div>
      </section>
    );
  }

  // Show error state
  if (error) {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  // Show payment failed state
  if (paymentStatus === 'canceled') {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-800 mb-2">Payment Failed</h1>
            <p className="text-red-700 mb-4">
              Your payment could not be processed. Please try again or contact support if you continue to experience issues.
            </p>
            <div className="mt-4">
              <Link 
                href="/events" 
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
              >
                Return to Events
              </Link>
            </div>
          </div>
          
          <div className="mt-6 text-sm text-gray-600">
            <p>If you have any questions, please email{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                support@example.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Show payment success state
  if (paymentStatus === 'paid') {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">Payment Successful!</h1>
            <p className="text-green-700">
              We appreciate your business! A confirmation email will be sent to{' '}
              {customerEmail}.
            </p>
          </div>
          
          {eventId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-2">Complete Your Event Registration</h2>
              <p className="text-blue-700 mb-4">
                Your payment has been processed successfully. Click the button below to complete your event registration.
              </p>
              <PostPaymentJoin eventId={eventId} />
            </div>
          )}
          
          <div className="mt-6 text-sm text-gray-600">
            <p>If you have any questions, please email{' '}
              <a href="mailto:admin@mentormates.ai" className="text-blue-600 hover:underline">
                admin@mentormates.ai
              </a>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Show processing state (waiting for webhook)
  return (
    <section className="mt-5 px-5">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
            <svg className="w-6 h-6 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-yellow-800 mb-2">Processing Payment</h1>
                       <p className="text-yellow-700">
               Your payment is being processed. This usually takes a few moments. Please don&apos;t close this page.
             </p>
        </div>
        
        <div className="mt-6 text-sm text-gray-600">
          <p>If you have any questions, please email{' '}
            <a href="mailto:admin@mentormates.ai" className="text-blue-600 hover:underline">
              admin@mentormates.ai
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
} 
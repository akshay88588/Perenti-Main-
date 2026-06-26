import { useState, useCallback } from 'react';

export function useRazorpay() {
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'failed'
  const [error, setError] = useState(null);

  const initiatePayment = useCallback(async (amountInPaise, onSuccess, onCancel) => {
    setPaymentStatus('processing');
    setError(null);

    try {
      // Use VITE_API_URL if defined (useful if frontend and backend are deployed separately on Render)
      const baseUrl = import.meta.env.VITE_API_URL || '';
      
      // 1. Call backend to create order
      const orderResponse = await fetch(`${baseUrl}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `receipt_${Date.now()}`
        })
      });

      if (!orderResponse.ok) {
        const contentType = orderResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await orderResponse.json();
          throw new Error(errorData.error || 'Failed to create order');
        } else {
          throw new Error('Backend server is not running or returned an invalid response. Please ensure `npm run server` is running in a separate terminal.');
        }
      }

      const orderData = await orderResponse.json();

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Perenti Events",
        description: "Event Registration",
        order_id: orderData.id,
        handler: async function (response) {
          try {
            // 3. On success, verify signature on backend
            const verifyResponse = await fetch(`${baseUrl}/api/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setPaymentStatus('success');
              if (onSuccess) onSuccess({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature
              });
            } else {
              setPaymentStatus('failed');
              setError('Payment verification failed.');
            }
          } catch (err) {
            console.error("Verification Error:", err);
            setPaymentStatus('failed');
            setError('Payment verification failed due to network error.');
          }
        },
        prefill: {
          name: "Attendee", // Could be populated from user profile
          email: "attendee@example.com", 
          contact: "9999999999"
        },
        theme: {
          color: "#059669" // Matches brand-primary
        },
        modal: {
          ondismiss: function() {
            setPaymentStatus('idle');
            if (onCancel) onCancel();
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        setPaymentStatus('failed');
        setError(response.error.description || 'Payment failed.');
      });

      rzp.open();

    } catch (err) {
      console.error("Payment initiation error:", err);
      setPaymentStatus('failed');
      setError(err.message || 'An error occurred during payment initiation.');
    }
  }, []);

  return { initiatePayment, paymentStatus, error };
}

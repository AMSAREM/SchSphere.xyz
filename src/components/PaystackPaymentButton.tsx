import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

interface PaystackButtonProps {
  amount: number;
  email: string;
  onSuccess: (reference: any) => void;
  onClose: () => void;
  className?: string;
  label?: string;
}

export default function PaystackPaymentButton({
  amount,
  email,
  onSuccess,
  onClose,
  className = '',
  label = 'Pay Now'
}: PaystackButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          email
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Payment initialization failed');
      }
      
      // Redirect to authorization URL
      window.location.href = data.data.authorization_url;
      // Note: We don't call onSuccess here as it will be handled on redirect back
    } catch (error) {
      console.error('Paystack error:', error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition ${className}`}
      onClick={handlePayment}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {isLoading ? 'Initializing...' : label}
    </button>
  );
}

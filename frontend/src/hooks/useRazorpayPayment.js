import { useState } from 'react';
import { loadRazorpay } from '../utils/loadRazorpay';

export const useRazorpayPayment = () => {
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);
    const [paymentError, setPaymentError] = useState(null);

    const initializePayment = async ({
        orderConfig,
        userConfig,
        onSuccess,
        onFailure
    }) => {
        setIsPaymentLoading(true);
        setPaymentError(null);

        try {
            await loadRazorpay();

            const options = {
                key: orderConfig.key, // from backend create-order
                amount: orderConfig.amount,
                currency: orderConfig.currency,
                name: userConfig.institute_name || "ZenithFlows App",
                description: userConfig.description || "Payment",
                order_id: orderConfig.order_id,
                handler: function (response) {
                    // Success callback
                    if(onSuccess) {
                        onSuccess({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                    }
                },
                prefill: {
                    name: userConfig.name || "",
                    email: userConfig.email || "",
                    contact: userConfig.contact || ""
                },
                theme: {
                    color: "#3b82f6" // matching primary brand color
                }
            };

            const rzp = new window.Razorpay(options);
            
            rzp.on('payment.failed', function (response) {
                const errorDesc = response.error.description;
                if (onFailure) {
                    onFailure(errorDesc, response.error);
                } else {
                    setPaymentError(errorDesc);
                }
            });

            rzp.open();

        } catch (err) {
            setPaymentError(err.message || 'Payment initiation failed');
        } finally {
            setIsPaymentLoading(false);
        }
    };

    return { initializePayment, isPaymentLoading, paymentError, setPaymentError };
};

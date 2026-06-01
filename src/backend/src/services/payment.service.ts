import CircuitBreaker from 'opossum';

// Mock function to simulate calling Payment Gateway API
const generatePaymentUrlMock = async (orderId: string, amount: number): Promise<string> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate 20% random failure to demonstrate circuit breaker
    if (Math.random() < 0.2) {
        throw new Error('Payment Gateway Error');
    }

    return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?orderId=${orderId}&amount=${amount}`;
};

const breakerOptions = {
    timeout: 3000,               // Request times out after 3 seconds
    errorThresholdPercentage: 50, // Circuit opens if 50% of requests fail
    resetTimeout: 15000          // Wait 15s before attempting a trial request (Half-Open)
};

export const paymentCircuitBreaker = new CircuitBreaker(generatePaymentUrlMock, breakerOptions);

paymentCircuitBreaker.on('open', () => console.log('Circuit Breaker OPEN - Payment Gateway is down'));
paymentCircuitBreaker.on('halfOpen', () => console.log('Circuit Breaker HALF-OPEN - Trial request allowed'));
paymentCircuitBreaker.on('close', () => console.log('Circuit Breaker CLOSED - Payment Gateway recovered'));

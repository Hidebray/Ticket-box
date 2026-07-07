import CircuitBreaker from 'opossum';
import crypto from 'crypto';
import querystring from 'querystring';

const tmnCode = process.env.VNPAY_TMN_CODE || 'DEMO1234';
const hashSecret = process.env.VNPAY_HASH_SECRET || 'SECRET1234567890';
const vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/checkout/callback';

const generateVnpayUrl = async (orderId: string, amount: number, ipAddr: string = '127.0.0.1'): Promise<string> => {
    const date = new Date();
    const createDate = date.getFullYear().toString() + 
        (date.getMonth() + 1).toString().padStart(2, '0') + 
        date.getDate().toString().padStart(2, '0') + 
        date.getHours().toString().padStart(2, '0') + 
        date.getMinutes().toString().padStart(2, '0') + 
        date.getSeconds().toString().padStart(2, '0');
        
    const vnp_Params: Record<string, string> = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: tmnCode,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
        vnp_OrderType: 'other',
        vnp_Amount: (amount * 100).toString(),
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
    };

    const sortedParams = Object.keys(vnp_Params)
        .sort()
        .reduce((result: Record<string, string>, key) => {
            result[key] = vnp_Params[key];
            return result;
        }, {});

    const signData = querystring.stringify(sortedParams, '&', '=');
    const hmac = crypto.createHmac('sha512', hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    sortedParams['vnp_SecureHash'] = signed;
    
    return vnpUrl + '?' + querystring.stringify(sortedParams, '&', '=');
};

const breakerOptions = {
    timeout: 5000,               // Request times out after 5 seconds
    errorThresholdPercentage: 50, // Circuit opens if 50% of requests fail
    resetTimeout: 15000          // Wait 15s before attempting a trial request (Half-Open)
};

export const paymentCircuitBreaker = new CircuitBreaker(generateVnpayUrl, breakerOptions);

paymentCircuitBreaker.on('open', () => console.log('Circuit Breaker OPEN - Payment Gateway is down'));
paymentCircuitBreaker.on('halfOpen', () => console.log('Circuit Breaker HALF-OPEN - Trial request allowed'));
paymentCircuitBreaker.on('close', () => console.log('Circuit Breaker CLOSED - Payment Gateway recovered'));

const digits = '0123456789';

export function generateOTP(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

export function verifyOTP(inputOtp, actualOtp) {
  return inputOtp === actualOtp;
}


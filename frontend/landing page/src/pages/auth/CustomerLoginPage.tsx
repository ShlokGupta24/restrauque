import { useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'phone') { 
      if (phone.replace(/\D/g, '').length < 10) return; 
      setStep('otp'); 
      return; 
    }
    if (step === 'otp') { 
      if (otp.length < 4) return; 
      setStep('done'); 
      return; 
    }
  };

  const title = step === 'done' ? 'You’re all set.' : 'Your table is waiting.';
  const subtitle = step === 'done' ? 'Demo verification complete. Real OTP verification will be enabled when the backend and SMS provider are connected.' : 'Sign in with your phone number to continue your restaurant experience.';

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      eyebrow="CUSTOMER ACCESS"
      showNewToLink={true}
    >
      {step === 'done' ? (
        <button className="button button-red" onClick={() => navigate('/')}>Back to website <ArrowRight size={16}/></button>
      ) : (
        <form onSubmit={submit}>
          {step === 'phone' ? (
            <>
              <label htmlFor="phone">Phone number</label>
              <div className="phone-input">
                <span>+91</span>
                <input id="phone" autoComplete="tel-national" inputMode="numeric" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile number" required minLength={10}/>
              </div>
              <button className="button button-red" type="submit">Continue with OTP <ArrowRight size={16}/></button>
            </>
          ) : (
            <>
              <label htmlFor="otp">Verification code</label>
              <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="Enter demo OTP" required minLength={4}/>
              <p className="auth-note">Demo only: any 4–6 digit code advances the UI. No SMS is sent.</p>
              <button className="button button-red" type="submit">Verify code <Check size={16}/></button>
              <button className="text-button" type="button" onClick={() => setStep('phone')}>Change phone number</button>
            </>
          )}
        </form>
      )}
    </AuthLayout>
  );
}

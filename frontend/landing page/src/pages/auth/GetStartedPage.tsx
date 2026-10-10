import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';

// This page acts as a fork in the road for new users.
// It asks them to identify as a Restaurant or a Customer and directs them to the correct login/signup flow.
export default function GetStartedPage() {
  const navigate = useNavigate();
  return (
    <AuthLayout
      title="Let’s grow together."
      subtitle="Choose how you want to get started with Restrauque."
      eyebrow="GET STARTED"
      showNewToLink={false}
    >
      <div className="get-started-options">
        <button className="button button-red" onClick={() => navigate('/login/restaurant')}>
          I run a restaurant <ArrowRight size={16}/>
        </button>
        <button className="button button-outline" onClick={() => navigate('/login/customer')}>
          I’m a customer <ArrowRight size={16}/>
        </button>
      </div>
    </AuthLayout>
  );
}

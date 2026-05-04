import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Overview from '@/components/Overview';
import UserRoles from '@/components/UserRoles';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Architecture from '@/components/Architecture';
import TechStack from '@/components/TechStack';
import Team from '@/components/Team';
import CTA from '@/components/CTA';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Overview />
      <UserRoles />
      <Features />
      <HowItWorks />
      <Architecture />
      <TechStack />
      <Team />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;

import React from "react";
import { ArrowRight, Menu, X } from "lucide-react";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient" | "outline";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/25",
      secondary: "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700",
      ghost: "hover:bg-slate-800/80 text-slate-300 hover:text-white",
      gradient: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:scale-[1.02] active:scale-95 shadow-xl hover:shadow-purple-500/25",
      outline: "border-2 border-indigo-500 text-indigo-400 hover:bg-indigo-500/10"
    };
    
    const sizes = {
      default: "h-11 px-5 py-2 text-sm",
      sm: "h-9 px-4 text-xs",
      lg: "h-14 px-8 text-base"
    };
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Navigation Component
const Navigation = React.memo(() => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              SaaSFlow
            </span>
          </div>
          
          <div className="hidden md:flex items-center justify-center gap-10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#getting-started" className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-500 transition-all group-hover:w-full"></span>
            </a>
            <a href="#components" className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
              Testimonials
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-500 transition-all group-hover:w-full"></span>
            </a>
            <a href="#documentation" className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-500 transition-all group-hover:w-full"></span>
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button type="button" variant="ghost" size="sm">
              Log in
            </Button>
            <Button type="button" variant="gradient" size="sm">
              Start Free Trial
            </Button>
          </div>

          <button
            type="button"
            className="md:hidden text-slate-300 hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-white/10 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-6 flex flex-col gap-4">
            <a
              href="#features"
              className="text-base font-medium text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#testimonials"
              className="text-base font-medium text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Testimonials
            </a>
            <a
              href="#pricing"
              className="text-base font-medium text-slate-300 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <div className="flex flex-col gap-3 pt-6 border-t border-white/10">
              <Button type="button" variant="outline" size="default" className="w-full">
                Log in
              </Button>
              <Button type="button" variant="gradient" size="default" className="w-full">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

// Hero Component
const Hero = React.memo(() => {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-start px-6 py-32 md:py-40 overflow-hidden"
      style={{
        animation: "fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>

      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] pointer-events-none opacity-40 z-0" style={{ animation: "pulseGlow 8s infinite alternate" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-[100px] rounded-full mix-blend-screen transform -translate-y-1/2"></div>
      </div>
      
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2560')] bg-cover bg-center opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

      <aside className="relative z-10 mb-10 inline-flex items-center justify-center gap-3 px-5 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 backdrop-blur-md shadow-lg shadow-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
        <span className="flex h-2 w-2 rounded-full bg-indigo-400">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
        </span>
        <span className="text-sm font-medium text-indigo-200">
          Introducing AI-Powered Workflows
        </span>
        <a
          href="#new-version"
          className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-indigo-300 transition-all"
        >
          Explore now
          <ArrowRight size={14} className="animate-pulse" />
        </a>
      </aside>

      <h1
        className="relative z-10 text-5xl md:text-6xl lg:text-7xl font-extrabold text-center max-w-4xl px-4 leading-[1.1] mb-8 tracking-tight"
      >
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-200 to-slate-400">
          Supercharge your
        </span>
        <br />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
          productivity engine
        </span>
      </h1>

      <p className="relative z-10 text-lg md:text-xl text-center max-w-2xl px-6 mb-12 text-slate-400 leading-relaxed">
        Stop wasting time on manual tasks. Our platform automates your workflow so you can focus on what actually matters—growing your business.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10 mb-20 w-full sm:w-auto px-6">
        <Button
          type="button"
          variant="gradient"
          size="lg"
          className="w-full sm:w-auto text-lg px-10 h-14"
        >
          Start building for free
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto text-lg px-10 h-14"
        >
          Book a demo
        </Button>
      </div>

      <div className="w-full max-w-6xl relative z-10 px-4 md:px-6">
        <div className="relative rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/20 bg-slate-900/50 backdrop-blur-sm p-2 md:p-4">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none"></div>
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000"
            alt="Dashboard preview showing analytics and metrics interface"
            className="w-full h-auto rounded-xl md:rounded-2xl shadow-inner border border-white/5 object-cover object-center"
            loading="eager"
            style={{ maxHeight: '700px' }}
          />
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

// Main Component
export default function Component() {
  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      <Navigation />
      <Hero />
    </main>
  );
}

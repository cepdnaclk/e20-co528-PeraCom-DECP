import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 -z-10 bg-sidebar"></div>

      {/* Decorative Blur Orbs for "Interactive" feel */}
      <div className="absolute top-1/4 left-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/20 blur-[120px]"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse rounded-full bg-purple-500/10 blur-[150px] delay-700"></div>

      <div className="text-center px-6">
        <h1 className="mb-2 text-9xl font-black tracking-tighter text-white/90 drop-shadow-2xl">
          404
        </h1>
        <h3 className="mb-0 text-xl font-bold tracking-wide text-indigo-100/80 uppercase">
          Oops! Page Not Found.
        </h3>
        <p className="mt-0 mb-8 text-xl font-light tracking-wide text-indigo-100/80 uppercase">
          <br /> The page you are looking for does not exist or has been moved.
        </p>

        <Link
          to="/"
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 px-10 py-3 text-white backdrop-blur-md transition-all hover:bg-white/20"
        >
          <span className="relative font-medium tracking-wide">
            Return to Home
          </span>
          {/* Subtle hover glow */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-500 group-hover:translate-x-[100%]"></div>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

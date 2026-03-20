import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserSummary } from "@/types";
import { GoogleCredentialResponse, GoogleLogin } from "@react-oauth/google";
import api from "@/services/api";
import { useEffect, useRef, useState } from "react";
import FakeGoogleSignup from "@/components/FakeGoogleSignup";

const SUB_TITLE =
  "Connect with fellow students and alumni. Collaborate on research, discover career opportunities, and grow together.";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showFallbackGoogleBtn, setShowFallbackGoogleBtn] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showFallbackGoogleBtn) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      const container = googleBtnContainerRef.current;
      const hasRenderedGoogleButton = !!container?.querySelector(
        'iframe, [id^="gsi_"], div[role="button"]',
      );

      if (!hasRenderedGoogleButton) {
        setShowFallbackGoogleBtn(true);
      }
    }, 1500);

    return () => window.clearTimeout(fallbackTimer);
  }, [showFallbackGoogleBtn]);

  const userVerify = async (credentialResponse: GoogleCredentialResponse) => {
    try {
      console.log("Request UserinfoReceived credential:", credentialResponse);

      const response = await api.post("identity/auth/google", {
        token: credentialResponse.credential,
      });
      console.log("Profile response:", response.data);
      const user: UserSummary = {
        userId: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.first_name,
        role: response.data.user.role,
      };
      login(user, response.data.access_token);
      navigate(user.role === "ADMIN" ? "/admin" : "/feed");
    } catch (error) {
      console.error("Fetch failed:", error.response?.data?.message);
      setError("Invalid Email! Login with your university email address.");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            D
          </div>
          <span className="text-2xl font-bold text-sidebar-primary-foreground">
            PeraCom DECP
          </span>
        </div>

        <div>
          <h1 className="mb-4 text-4xl font-bold leading-tight text-sidebar-primary-foreground">
            Department Engagement <br />& Career Platform
          </h1>
          <p className="max-w-md text-lg text-sidebar-foreground">
            {SUB_TITLE}
          </p>
        </div>

        <p className="text-sm text-sidebar-foreground/60">
          © 2026 PeraCom DECP. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-sidebar lg:bg-muted">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center justify-center gap-2 lg:hidden bg-white p-4 w-full max-w-sm rounded-xl shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            D
          </div>
          <span className="text-2xl font-bold">PeraCom DECP</span>
        </div>

        <div className="mb-8 lg:hidden text-center">
          <p className="max-w-md text-lg text-sidebar-foreground">
            {SUB_TITLE}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl p-6 bg-card lg:bg-transparent">
          <h2 className="mb-2 text-2xl font-bold text-foreground text-center">
            Welcome back
          </h2>
          <p className="mb-8 text-muted-foreground text-center">
            Sign in to access PeraCom community
          </p>

          {/* Google Login */}
          <div className="mb-6 flex justify-center">
            {showFallbackGoogleBtn ? (
              <FakeGoogleSignup onClick={(cr) => userVerify(cr)} />
            ) : (
              <div ref={googleBtnContainerRef}>
                <GoogleLogin
                  onSuccess={(credentialResponse) =>
                    userVerify(credentialResponse)
                  }
                  onError={() => {
                    console.log("Google Login failed to initialize");
                    setShowFallbackGoogleBtn(true);
                  }}
                  shape="pill"
                  logo_alignment="center"
                  text="continue_with"
                />
              </div>
            )}
          </div>

          {/* Error message component */}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex-1">{error}</div>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="ml-3 rounded px-2 py-1 text-xs font-medium hover:bg-destructive/5"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="w-full mt-8 lg:hidden px-4">
          <p className="text-sm text-sidebar-foreground/60 text-center">
            © 2026 PeraCom DECP. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

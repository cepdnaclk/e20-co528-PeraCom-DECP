import { GoogleCredentialResponse } from "@react-oauth/google";

// The official Google "G" Logo as an SVG
const GoogleIcon = () => (
  <svg
    className="mr-2 h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const credentialResponse: GoogleCredentialResponse = {
  clientId:
    "866050157820-nq4fkb1dokdbfsh2033vba5n2ki01hg8.apps.googleusercontent.com",
  credential:
    "eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MWYxNDFhYTE5ZGYwYWM5N2RhYTU1ZTYwMDc2NmM0YzUzNjRjNDIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4NjYwNTAxNTc4MjAtbnE0ZmtiMWRva2RiZnNoMjAzM3ZiYTVuMmtpMDFoZzguYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4NjYwNTAxNTc4MjAtbnE0ZmtiMWRva2RiZnNoMjAzM3ZiYTVuMmtpMDFoZzguYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTY0MjczNjQ1MjMxNTk4MzAzOTUiLCJoZCI6ImVuZy5wZG4uYWMubGsiLCJlbWFpbCI6ImUyMDE1N0BlbmcucGRuLmFjLmxrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5iZiI6MTc3NDAxMzA4MiwibmFtZSI6IlMuTS5CLkcuIEpBTkFLQU5USEEiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSVFqekZRcWVrOXBaT0JyZ2k1WldySDAwYU1ERk1NeU1WRnlLTm5MRGJoTlhBbmp3PXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IlMuTS5CLkcuIiwiZmFtaWx5X25hbWUiOiJKQU5BS0FOVEhBIiwiaWF0IjoxNzc0MDEzMzgyLCJleHAiOjE3NzQwMTY5ODIsImp0aSI6Ijk1NGM3ZTBkNTMxY2ZmNGFjZDk3MDdiNTEwYjUwODc0YzQ4YjI5MjMifQ.fbHoTSmd6wAYaq5UliJi1B9qwxGatuaevR5dVj9bDDw9yd3D05tDqo06ouQvD2gWP24_1f5Zt2PvrtE9eu9jETDLCMxogDlpypN892s2bYbC_xGduC31B3mpu5IZLyUMxgZ6zZsq2ek2PuArKX1zppxIk16tgqZxKtx8FgqJaB0z85wH9GxtC0u1nHnQSw3iA8_gUXhdyHu3VaSLKNGYLFm_qjTQ4oWL76qqlYMb2FZxX2vhHvPuAQ9TlpO3HpktB0KM6oTeywCIfiJPsX3cuF4Z2gou9orIwfFzdqH_SQvIP_1l-vR4IDKRMcUqVB7B5S0uWcJrlFxAB_sg1vPG2w",
  select_by: "btn",
};

export default function FakeGoogleSignup({
  onClick,
}: {
  onClick?: (credentialResponse: GoogleCredentialResponse) => void;
}) {
  return (
    <button
      onClick={() => onClick?.(credentialResponse)}
      className="flex w-auto items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98]"
    >
      <GoogleIcon />
      Continue with Google...
    </button>
  );
}

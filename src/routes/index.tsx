import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">MetaTwin</h1>
      <p className="text-gray-500">
        A student's verified digital twin — built from enrolment through graduation, matched to
        opportunities before they graduate.
      </p>
      {!loading && (
        <div className="flex gap-3">
          {user ? (
            <Link to="/dashboard" className="rounded-md bg-blue-600 px-5 py-2 text-white">
              Go to your twin
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-md border px-5 py-2">
                Log in
              </Link>
              <Link to="/signup" className="rounded-md bg-blue-600 px-5 py-2 text-white">
                Build your twin
              </Link>
            </>
          )}
        </div>
      )}
    </main>
  );
}

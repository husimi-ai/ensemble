import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, OrDivider } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { getUser } from "@/lib/auth/user";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; checkEmail?: string };
}) {
  if (await getUser()) redirect("/");
  const next = searchParams.next ?? "/";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to Ensemble"
      footer={
        <>
          New to Ensemble?{" "}
          <Link href="/signup" className="font-medium text-fg hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {searchParams.checkEmail ? (
        <p className="mb-3 rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-fg-secondary">
          Check your email to confirm your account, then sign in.
        </p>
      ) : null}
      {searchParams.error ? (
        <p className="mb-3 text-sm text-danger">Something went wrong signing you in. Please try again.</p>
      ) : null}
      <LinkedInButton next={next} />
      <OrDivider />
      <EmailAuthForm mode="login" next={next} />
    </AuthShell>
  );
}

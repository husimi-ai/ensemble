import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, OrDivider } from "@/components/auth/AuthShell";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { getUser } from "@/lib/auth/user";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  if (await getUser()) redirect("/");
  const next = searchParams.next ?? "/";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Ensemble"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fg hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <LinkedInButton next={next} />
      <OrDivider />
      <EmailAuthForm mode="signup" next={next} />
      <p className="mt-4 text-center text-xs text-fg-muted">
        We build your profile only from sources you provide (GDPR Art. 14).
      </p>
    </AuthShell>
  );
}

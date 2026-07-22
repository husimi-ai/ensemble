import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/user";

const FEATURES = [
  {
    title: "Investigated profiles",
    body: "Your public scholarly footprint, stitched into a durable profile you review and correct.",
  },
  {
    title: "Balanced teams",
    body: "Apply to a problem and get matched into a role-complete ensemble of identifiers, builders, and researchers.",
  },
  {
    title: "AI in the room",
    body: "A shared AI participant launches research, drafts work guides, and finds specialists, on request.",
  },
];

/** Marketing landing. Authenticated visitors are sent straight to the feed. */
export default async function LandingPage() {
  if (await getUser()) redirect("/feed");

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-fg-inverted">
            E
          </span>
          <span className="text-lg font-semibold text-fg">Ensemble</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-fg hover:bg-hover"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-fg-inverted hover:bg-primary-hover"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold leading-tight text-fg sm:text-4xl">
          A research venture studio, assembled around you
        </h1>
        <p className="mt-4 max-w-xl text-base text-fg-secondary">
          Ensemble turns a medical research problem into a balanced team and a shared
          workspace — profile, apply, and build with an AI participant in the room.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-fg-inverted hover:bg-primary-hover"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-fg hover:bg-hover"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line-light bg-subtle p-5">
              <h2 className="text-sm font-semibold text-fg">{f.title}</h2>
              <p className="mt-1.5 text-sm text-fg-secondary">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

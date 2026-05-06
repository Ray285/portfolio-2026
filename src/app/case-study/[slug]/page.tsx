import type { Metadata } from "next";
import Link from "next/link";

const TITLES: Record<string, string> = {
  "selected-work": "Selected work",
  "launch-notes": "Launch notes",
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = TITLES[slug] ?? slug;
  return {
    title: `${title} | Raymond Lemon`,
    description: `Case study: ${title}.`,
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const title = TITLES[slug] ?? slug.replace(/-/g, " ");

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-16">
      <p className="mb-8">
        <Link
          className="text-sm text-zinc-500 underline-offset-2 hover:underline"
          href="/"
        >
          Back to desk
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-zinc-900 capitalize">
        {title}
      </h1>
      <p className="text-zinc-600">
        This is a placeholder case-study page. Replace this copy with your
        narrative, media, and links. The slug is{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
          {slug}
        </code>
        .
      </p>
    </main>
  );
}

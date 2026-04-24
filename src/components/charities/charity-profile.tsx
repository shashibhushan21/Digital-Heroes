"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatedCard, AnimatedSection } from "@/components/ui/animated-surface";

type CharityProfileResponse = {
  charity: {
    id: string;
    slug: string;
    name: string;
    short_description: string;
    long_description: string;
    website_url: string | null;
    is_featured: boolean;
  };
  media: Array<{
    id: string;
    media_url: string;
    alt_text: string;
    caption: string | null;
    sort_order: number;
  }>;
  events: Array<{
    id: string;
    title: string;
    description: string;
    event_image_url: string | null;
    location: string | null;
    event_url: string | null;
    starts_at: string;
    ends_at: string | null;
    is_published: boolean;
  }>;
  error?: string;
};

async function getCharityProfile(slug: string): Promise<CharityProfileResponse> {
  const response = await fetch(`/api/charities/${slug}`);
  const payload = (await response.json()) as CharityProfileResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load charity profile.");
  }

  return payload;
}

function prettyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function CharityProfile({ slug }: { slug: string }) {
  const profileQuery = useQuery({
    queryKey: ["charity-profile", slug],
    queryFn: () => getCharityProfile(slug),
  });

  return (
    <AnimatedSection className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <Link href="/charities" className="text-sm font-semibold text-slate-700 underline decoration-slate-400 underline-offset-4">
        Back to Charity Directory
      </Link>

      {profileQuery.isLoading ? <p className="mt-4 text-sm text-slate-600">Loading charity profile...</p> : null}
      {profileQuery.error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(profileQuery.error as Error).message}
        </p>
      ) : null}

      {profileQuery.data ? (
        <>
          <AnimatedCard className="mt-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl text-slate-950">{profileQuery.data.charity.name}</h1>
              {profileQuery.data.charity.is_featured ? (
                <span className="rounded-full bg-warm px-3 py-1 text-xs font-semibold text-slate-800">Featured</span>
              ) : null}
            </div>
            <p className="mt-3 text-slate-700">{profileQuery.data.charity.long_description}</p>
            {profileQuery.data.charity.website_url ? (
              <a
                href={profileQuery.data.charity.website_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4"
              >
                Visit official website
              </a>
            ) : null}
          </AnimatedCard>

          <AnimatedCard className="mt-6 p-6">
            <h2 className="font-display text-2xl text-slate-900">Gallery</h2>
            {profileQuery.data.media.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {profileQuery.data.media.map((item) => (
                  <figure key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <Image
                      src={item.media_url}
                      alt={item.alt_text || "Charity media"}
                      width={960}
                      height={512}
                      className="h-44 w-full object-cover"
                    />
                    {item.caption ? <figcaption className="px-3 py-2 text-xs text-slate-700">{item.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No media has been published yet.</p>
            )}
          </AnimatedCard>

          <AnimatedCard className="mt-6 p-6">
            <h2 className="font-display text-2xl text-slate-900">Upcoming and Recent Events</h2>
            {profileQuery.data.events.length ? (
              <div className="mt-4 space-y-4">
                {profileQuery.data.events.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-slate-200 p-4">
                    {event.event_image_url ? (
                      <Image
                        src={event.event_image_url}
                        alt={`Event image for ${event.title}`}
                        width={960}
                        height={540}
                        className="mb-3 h-48 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                      <p className="text-xs text-slate-600">{prettyDate(event.starts_at)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{event.description}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                      {event.location ? <span>Location: {event.location}</span> : null}
                      {event.ends_at ? <span>Ends: {prettyDate(event.ends_at)}</span> : null}
                    </div>
                    {event.event_url ? (
                      <a href={event.event_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-slate-900 underline">
                        Event details
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No charity events are currently published.</p>
            )}
          </AnimatedCard>
        </>
      ) : null}
    </AnimatedSection>
  );
}

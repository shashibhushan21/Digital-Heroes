"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { AnimatedCard } from "@/components/ui/animated-surface";

type CharityMedia = {
  id: string;
  media_url: string;
  alt_text: string;
  caption: string | null;
  sort_order: number;
  is_active: boolean;
};

type CharityEvent = {
  id: string;
  title: string;
  description: string;
  event_image_url: string | null;
  location: string | null;
  event_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_published: boolean;
};

type Charity = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  long_description: string;
  website_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  charity_media: CharityMedia[];
  charity_events: CharityEvent[];
};

type CharityFormState = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  websiteUrl: string;
  isFeatured: boolean;
  isActive: boolean;
};

const emptyForm: CharityFormState = {
  slug: "",
  name: "",
  shortDescription: "",
  longDescription: "",
  websiteUrl: "",
  isFeatured: false,
  isActive: true,
};

type MediaFormState = {
  mediaUrl: string;
  altText: string;
  caption: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyMediaForm: MediaFormState = {
  mediaUrl: "",
  altText: "",
  caption: "",
  sortOrder: 0,
  isActive: true,
};

type EventFormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  eventUrl: string;
  eventImageUrl: string;
  isPublished: boolean;
};

const emptyEventForm: EventFormState = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  location: "",
  eventUrl: "",
  eventImageUrl: "",
  isPublished: true,
};

function isoToLocalDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function localDateTimeToIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

type SignedUploadResponse = {
  upload?: {
    bucket: string;
    path: string;
    token: string;
  };
  publicUrl?: string;
  error?: string;
};

async function uploadCharityImageFile({
  charityId,
  file,
  purpose,
}: {
  charityId: string;
  file: File;
  purpose: "media" | "event";
}): Promise<string> {
  const signResponse = await fetch(`/api/admin/charities/${charityId}/image-upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
    }),
  });

  const signPayload = (await signResponse.json()) as SignedUploadResponse;
  if (!signResponse.ok || !signPayload.upload || !signPayload.publicUrl) {
    throw new Error(signPayload.error ?? "Unable to prepare image upload.");
  }

  const supabase = createClientSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(signPayload.upload.bucket)
    .uploadToSignedUrl(signPayload.upload.path, signPayload.upload.token, file);

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return signPayload.publicUrl;
}

async function getAdminCharities(): Promise<{ charities: Charity[]; error?: string }> {
  const response = await fetch("/api/admin/charities");
  const payload = (await response.json()) as { charities: Charity[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to fetch charities.");
  }
  return payload;
}

export function CharityManagementPanel() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<CharityFormState>(emptyForm);
  const [editingCharityId, setEditingCharityId] = useState<string | null>(null);
  const [contentCharityId, setContentCharityId] = useState<string | null>(null);
  const [mediaFormState, setMediaFormState] = useState<MediaFormState>(emptyMediaForm);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [eventFormState, setEventFormState] = useState<EventFormState>(emptyEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventImageFile, setSelectedEventImageFile] = useState<File | null>(null);

  const charitiesQuery = useQuery({ queryKey: ["admin-charities"], queryFn: getAdminCharities });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/charities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create charity.");
      }
    },
    onSuccess: async () => {
      setFormState(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCharityId) return;
      const response = await fetch(`/api/admin/charities/${editingCharityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update charity.");
      }
    },
    onSuccess: async () => {
      setEditingCharityId(null);
      setFormState(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (charityId: string) => {
      const response = await fetch(`/api/admin/charities/${charityId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to deactivate charity.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const ordered = useMemo(() => charitiesQuery.data?.charities ?? [], [charitiesQuery.data?.charities]);
  const contentCharity = useMemo(
    () => ordered.find((charity) => charity.id === contentCharityId) ?? null,
    [contentCharityId, ordered],
  );

  const createMediaMutation = useMutation({
    mutationFn: async () => {
      if (!contentCharityId) return;
      const uploadedMediaUrl =
        selectedMediaFile !== null
          ? await uploadCharityImageFile({
              charityId: contentCharityId,
              file: selectedMediaFile,
              purpose: "media",
            })
          : null;

      const mediaUrl = uploadedMediaUrl ?? mediaFormState.mediaUrl.trim();
      if (!mediaUrl) {
        throw new Error("Provide a media URL or upload an image file.");
      }

      const response = await fetch(`/api/admin/charities/${contentCharityId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mediaFormState,
          mediaUrl,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create charity media.");
      }
    },
    onSuccess: async () => {
      setMediaFormState(emptyMediaForm);
      setSelectedMediaFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const updateMediaMutation = useMutation({
    mutationFn: async () => {
      if (!contentCharityId || !editingMediaId) return;
      const uploadedMediaUrl =
        selectedMediaFile !== null
          ? await uploadCharityImageFile({
              charityId: contentCharityId,
              file: selectedMediaFile,
              purpose: "media",
            })
          : null;

      const mediaUrl = uploadedMediaUrl ?? mediaFormState.mediaUrl.trim();
      if (!mediaUrl) {
        throw new Error("Provide a media URL or upload an image file.");
      }

      const response = await fetch(`/api/admin/charities/${contentCharityId}/media/${editingMediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mediaFormState,
          mediaUrl,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update charity media.");
      }
    },
    onSuccess: async () => {
      setEditingMediaId(null);
      setMediaFormState(emptyMediaForm);
      setSelectedMediaFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!contentCharityId) return;
      const response = await fetch(`/api/admin/charities/${contentCharityId}/media/${mediaId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete charity media.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!contentCharityId) return;
      const uploadedEventImageUrl =
        selectedEventImageFile !== null
          ? await uploadCharityImageFile({
              charityId: contentCharityId,
              file: selectedEventImageFile,
              purpose: "event",
            })
          : null;

      const response = await fetch(`/api/admin/charities/${contentCharityId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...eventFormState,
          eventImageUrl: uploadedEventImageUrl ?? eventFormState.eventImageUrl,
          startsAt: localDateTimeToIso(eventFormState.startsAt),
          endsAt: eventFormState.endsAt ? localDateTimeToIso(eventFormState.endsAt) : "",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create charity event.");
      }
    },
    onSuccess: async () => {
      setEventFormState(emptyEventForm);
      setSelectedEventImageFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async () => {
      if (!contentCharityId || !editingEventId) return;
      const uploadedEventImageUrl =
        selectedEventImageFile !== null
          ? await uploadCharityImageFile({
              charityId: contentCharityId,
              file: selectedEventImageFile,
              purpose: "event",
            })
          : null;

      const response = await fetch(`/api/admin/charities/${contentCharityId}/events/${editingEventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...eventFormState,
          eventImageUrl: uploadedEventImageUrl ?? eventFormState.eventImageUrl,
          startsAt: localDateTimeToIso(eventFormState.startsAt),
          endsAt: eventFormState.endsAt ? localDateTimeToIso(eventFormState.endsAt) : "",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update charity event.");
      }
    },
    onSuccess: async () => {
      setEditingEventId(null);
      setEventFormState(emptyEventForm);
      setSelectedEventImageFile(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!contentCharityId) return;
      const response = await fetch(`/api/admin/charities/${contentCharityId}/events/${eventId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete charity event.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-charities"] });
    },
  });

  return (
    <AnimatedCard className="p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Charity CMS</p>
      <h2 className="mt-1 font-display text-2xl text-slate-950">Charity Management</h2>
      <p className="mt-1 text-sm text-slate-600">Create, edit, and deactivate charities without direct database access.</p>

      <form
        className="mt-5 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (editingCharityId) {
            updateMutation.mutate();
            return;
          }
          createMutation.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={formState.slug}
            onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="slug"
          />
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Charity name"
          />
        </div>

        <input
          value={formState.websiteUrl}
          onChange={(event) => setFormState((current) => ({ ...current, websiteUrl: event.target.value }))}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Website URL"
        />

        <input
          value={formState.shortDescription}
          onChange={(event) => setFormState((current) => ({ ...current, shortDescription: event.target.value }))}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Short description"
        />

        <textarea
          value={formState.longDescription}
          onChange={(event) => setFormState((current) => ({ ...current, longDescription: event.target.value }))}
          className="min-h-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Long description"
        />

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={formState.isFeatured}
              onChange={(event) => setFormState((current) => ({ ...current, isFeatured: event.target.checked }))}
            />
            Featured
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {editingCharityId
              ? updateMutation.isPending
                ? "Saving..."
                : "Save Changes"
              : createMutation.isPending
                ? "Creating..."
                : "Create Charity"}
          </button>

          {editingCharityId ? (
            <button
              type="button"
              onClick={() => {
                setEditingCharityId(null);
                setFormState(emptyForm);
              }}
              className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        {createMutation.error ? <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p> : null}
        {updateMutation.error ? <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p> : null}
      </form>

      {charitiesQuery.isLoading ? <p className="mt-4 text-sm text-slate-600">Loading charities...</p> : null}
      {charitiesQuery.error ? <p className="mt-4 text-sm text-red-600">{(charitiesQuery.error as Error).message}</p> : null}

      <div className="mt-5 space-y-3">
        {ordered.map((charity) => (
          <article key={charity.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{charity.name}</p>
              <p className="text-xs text-slate-600">{charity.is_active ? "active" : "inactive"}</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Slug: {charity.slug}</p>
            <p className="mt-1 text-xs text-slate-600">{charity.short_description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingCharityId(charity.id);
                  setFormState({
                    slug: charity.slug,
                    name: charity.name,
                    shortDescription: charity.short_description,
                    longDescription: charity.long_description,
                    websiteUrl: charity.website_url ?? "",
                    isFeatured: charity.is_featured,
                    isActive: charity.is_active,
                  });
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => {
                  setContentCharityId(charity.id);
                  setEditingMediaId(null);
                  setMediaFormState(emptyMediaForm);
                  setSelectedMediaFile(null);
                  setEditingEventId(null);
                  setEventFormState(emptyEventForm);
                  setSelectedEventImageFile(null);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Manage Content
              </button>

              {charity.is_active ? (
                <button
                  type="button"
                  onClick={() => deactivateMutation.mutate(charity.id)}
                  disabled={deactivateMutation.isPending}
                  className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                >
                  Deactivate
                </button>
              ) : null}
            </div>

            {contentCharityId === charity.id ? (
              <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Charity Media</h3>
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editingMediaId) {
                      updateMediaMutation.mutate();
                      return;
                    }
                    createMediaMutation.mutate();
                  }}
                >
                  <input
                    value={mediaFormState.mediaUrl}
                    onChange={(event) => setMediaFormState((current) => ({ ...current, mediaUrl: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Media URL"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedMediaFile(event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  {selectedMediaFile ? <p className="text-xs text-slate-600">Selected file: {selectedMediaFile.name}</p> : null}
                  <input
                    value={mediaFormState.altText}
                    onChange={(event) => setMediaFormState((current) => ({ ...current, altText: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Alt text"
                  />
                  <input
                    value={mediaFormState.caption}
                    onChange={(event) => setMediaFormState((current) => ({ ...current, caption: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Caption"
                  />
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={mediaFormState.sortOrder}
                    onChange={(event) =>
                      setMediaFormState((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Sort order"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={mediaFormState.isActive}
                      onChange={(event) =>
                        setMediaFormState((current) => ({ ...current, isActive: event.target.checked }))
                      }
                    />
                    Active media
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={createMediaMutation.isPending || updateMediaMutation.isPending}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {editingMediaId
                        ? updateMediaMutation.isPending
                          ? "Saving..."
                          : "Save Media"
                        : createMediaMutation.isPending
                          ? "Adding..."
                          : "Add Media"}
                    </button>
                    {editingMediaId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMediaId(null);
                          setMediaFormState(emptyMediaForm);
                          setSelectedMediaFile(null);
                        }}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  {createMediaMutation.error ? (
                    <p className="text-xs text-red-600">{(createMediaMutation.error as Error).message}</p>
                  ) : null}
                  {updateMediaMutation.error ? (
                    <p className="text-xs text-red-600">{(updateMediaMutation.error as Error).message}</p>
                  ) : null}
                </form>

                <div className="space-y-2">
                  {(contentCharity?.charity_media ?? [])
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((media) => (
                      <article key={media.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-900">{media.media_url}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {media.alt_text || "No alt text"} {media.caption ? `- ${media.caption}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMediaId(media.id);
                              setSelectedMediaFile(null);
                              setMediaFormState({
                                mediaUrl: media.media_url,
                                altText: media.alt_text,
                                caption: media.caption ?? "",
                                sortOrder: media.sort_order,
                                isActive: media.is_active,
                              });
                            }}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMediaMutation.mutate(media.id)}
                            disabled={deleteMediaMutation.isPending}
                            className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  {deleteMediaMutation.error ? (
                    <p className="text-xs text-red-600">{(deleteMediaMutation.error as Error).message}</p>
                  ) : null}
                  {!contentCharity?.charity_media?.length ? (
                    <p className="text-xs text-slate-600">No media items yet.</p>
                  ) : null}
                </div>

                <h3 className="text-sm font-semibold text-slate-900">Charity Events</h3>
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editingEventId) {
                      updateEventMutation.mutate();
                      return;
                    }
                    createEventMutation.mutate();
                  }}
                >
                  <input
                    value={eventFormState.title}
                    onChange={(event) => setEventFormState((current) => ({ ...current, title: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Event title"
                    required
                  />
                  <textarea
                    value={eventFormState.description}
                    onChange={(event) =>
                      setEventFormState((current) => ({ ...current, description: event.target.value }))
                    }
                    className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Event description"
                    required
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={eventFormState.startsAt}
                      onChange={(event) =>
                        setEventFormState((current) => ({ ...current, startsAt: event.target.value }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                    <input
                      type="datetime-local"
                      value={eventFormState.endsAt}
                      onChange={(event) => setEventFormState((current) => ({ ...current, endsAt: event.target.value }))}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={eventFormState.location}
                    onChange={(event) => setEventFormState((current) => ({ ...current, location: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Location"
                  />
                  <input
                    value={eventFormState.eventUrl}
                    onChange={(event) => setEventFormState((current) => ({ ...current, eventUrl: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Event URL"
                  />
                  <input
                    value={eventFormState.eventImageUrl}
                    onChange={(event) =>
                      setEventFormState((current) => ({ ...current, eventImageUrl: event.target.value }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Event image URL"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedEventImageFile(event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  {selectedEventImageFile ? (
                    <p className="text-xs text-slate-600">Selected event image: {selectedEventImageFile.name}</p>
                  ) : null}
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={eventFormState.isPublished}
                      onChange={(event) =>
                        setEventFormState((current) => ({ ...current, isPublished: event.target.checked }))
                      }
                    />
                    Published
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={createEventMutation.isPending || updateEventMutation.isPending}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {editingEventId
                        ? updateEventMutation.isPending
                          ? "Saving..."
                          : "Save Event"
                        : createEventMutation.isPending
                          ? "Adding..."
                          : "Add Event"}
                    </button>
                    {editingEventId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEventId(null);
                          setEventFormState(emptyEventForm);
                          setSelectedEventImageFile(null);
                        }}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  {createEventMutation.error ? (
                    <p className="text-xs text-red-600">{(createEventMutation.error as Error).message}</p>
                  ) : null}
                  {updateEventMutation.error ? (
                    <p className="text-xs text-red-600">{(updateEventMutation.error as Error).message}</p>
                  ) : null}
                </form>

                <div className="space-y-2">
                  {(contentCharity?.charity_events ?? []).map((charityEvent) => (
                    <article key={charityEvent.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-900">{charityEvent.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{new Date(charityEvent.starts_at).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-600">{charityEvent.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventId(charityEvent.id);
                            setSelectedEventImageFile(null);
                            setEventFormState({
                              title: charityEvent.title,
                              description: charityEvent.description,
                              startsAt: isoToLocalDateTime(charityEvent.starts_at),
                              endsAt: charityEvent.ends_at ? isoToLocalDateTime(charityEvent.ends_at) : "",
                              location: charityEvent.location ?? "",
                              eventUrl: charityEvent.event_url ?? "",
                              eventImageUrl: charityEvent.event_image_url ?? "",
                              isPublished: charityEvent.is_published,
                            });
                          }}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEventMutation.mutate(charityEvent.id)}
                          disabled={deleteEventMutation.isPending}
                          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                  {deleteEventMutation.error ? (
                    <p className="text-xs text-red-600">{(deleteEventMutation.error as Error).message}</p>
                  ) : null}
                  {!contentCharity?.charity_events?.length ? (
                    <p className="text-xs text-slate-600">No charity events yet.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        ))}

        {!ordered.length ? <p className="text-sm text-slate-600">No charities available.</p> : null}
      </div>
    </AnimatedCard>
  );
}

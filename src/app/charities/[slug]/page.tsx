import { CharityProfile } from "@/components/charities/charity-profile";

type CharityProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CharityProfilePage({ params }: CharityProfilePageProps) {
  const { slug } = await params;

  return <CharityProfile slug={slug} />;
}

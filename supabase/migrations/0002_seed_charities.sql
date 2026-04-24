insert into public.charities (slug, name, short_description, long_description, website_url, is_featured, is_active)
values
  (
    'fairways-for-future',
    'Fairways for Future',
    'Funding youth access to golf and mentorship programs.',
    'Fairways for Future supports underserved communities through equipment grants, coaching scholarships, and mentorship programs that use golf as a pathway to confidence and life skills.',
    'https://example.org/fairways-for-future',
    true,
    true
  ),
  (
    'greens-for-good',
    'Greens for Good',
    'Community health and wellness initiatives tied to sport.',
    'Greens for Good invests in local wellness camps, rehabilitation support, and community-led fitness initiatives designed to improve long-term health outcomes.',
    'https://example.org/greens-for-good',
    false,
    true
  ),
  (
    'swing-for-schools',
    'Swing for Schools',
    'Education grants for children and families in need.',
    'Swing for Schools provides school supplies, digital learning resources, and emergency tuition support for families facing financial hardship.',
    'https://example.org/swing-for-schools',
    false,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  website_url = excluded.website_url,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  updated_at = now();

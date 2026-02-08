import supabase from '@/lib/supabase';

export type LocationRecord = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  created_at?: string | null;
  active?: boolean | null;
  companies?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
  } | null;
};

export type CompanyRecord = {
  id: string;
  name: string;
  slug: string;
  created_at?: string | null;
  active?: boolean | null;
};

export type UserRecord = {
  id: string;
  email: string | null;
  username: string | null;
  role?: string | null;
  image?: string | null;
  company_id?: string | null;
  created_at?: string | null;
};

export type SettingsRecord = {
  sso_username?: string | null;
  sso_password?: string | null;
  ui_handedness?: string | null;
  last_sync_asis_at?: string | null;
  last_sync_fg_at?: string | null;
  last_sync_sta_at?: string | null;
  last_sync_inbound_at?: string | null;
  last_sync_backhaul_at?: string | null;
  last_sync_inventory_at?: string | null;
};

export async function getLocations(): Promise<LocationRecord[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, company_id, name, slug, created_at, active, companies:company_id (id, name, slug)')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as LocationRecord[];
}

export async function getCompanies(): Promise<CompanyRecord[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, created_at, active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CompanyRecord[];
}

export async function getUsers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, role, image, company_id, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserRecord[];
}

export async function resolveLocationSettings(activeLocationKey: string): Promise<{
  location: LocationRecord;
  settings: SettingsRecord | null;
}> {
  const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    activeLocationKey
  );

  const locationQuery = supabase.from('locations').select('id, company_id, name, slug');
  const locationLookup = isUuidLike
    ? await locationQuery.eq('id', activeLocationKey).maybeSingle()
    : await locationQuery.eq('slug', activeLocationKey).maybeSingle();

  let location = locationLookup.data as LocationRecord | null;
  let locationError = locationLookup.error;

  if (!location?.id && isUuidLike) {
    const fallbackLookup = await supabase
      .from('locations')
      .select('id, company_id, name, slug')
      .eq('company_id', activeLocationKey)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackLookup.data) {
      location = fallbackLookup.data as LocationRecord;
      locationError = null;
    } else if (fallbackLookup.error) {
      locationError = fallbackLookup.error;
    }
  }

  if (locationError) throw locationError;
  if (!location?.id) throw new Error(`No location found for "${activeLocationKey}".`);

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('sso_username, sso_password, ui_handedness, last_sync_asis_at, last_sync_fg_at, last_sync_sta_at, last_sync_inbound_at, last_sync_backhaul_at, last_sync_inventory_at')
    .eq('location_id', location.id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  return { location, settings: (settings ?? null) as SettingsRecord | null };
}

export async function updateLocation(locationId: string, name: string, slug: string): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({ name, slug })
    .eq('id', locationId);

  if (error) throw error;
}

export async function upsertSettings(input: {
  locationId: string;
  companyId: string;
  ssoUsername?: string | null;
  ssoPassword?: string | null;
  uiHandedness?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert(
      {
        location_id: input.locationId,
        company_id: input.companyId,
        sso_username: input.ssoUsername ?? null,
        sso_password: input.ssoPassword ?? null,
        ui_handedness: input.uiHandedness ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id' }
    );

  if (error) throw error;
}

export async function createLocation(input: {
  name: string;
  slug: string;
  companyId: string;
}): Promise<LocationRecord> {
  const { data, error } = await supabase
    .from('locations')
    .insert({ name: input.name, slug: input.slug, company_id: input.companyId })
    .select('id, name, slug, company_id')
    .single();

  if (error || !data) throw error ?? new Error('Failed to create location');
  return data as LocationRecord;
}

export async function updateCompany(input: {
  companyId: string;
  name: string;
  slug: string;
}): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ name: input.name, slug: input.slug })
    .eq('id', input.companyId);

  if (error) throw error;
}

export async function createCompany(input: {
  name: string;
  slug: string;
}): Promise<CompanyRecord> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ name: input.name, slug: input.slug })
    .select('id, name, slug')
    .single();

  if (error || !data) throw error ?? new Error('Failed to create company');
  return data as CompanyRecord;
}

export async function updateUserProfile(input: {
  id: string;
  username: string;
  role?: string | null;
  companyId?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      username: input.username,
      role: input.role ?? 'member',
      company_id: input.companyId ?? null,
    })
    .eq('id', input.id);

  if (error) throw error;
}

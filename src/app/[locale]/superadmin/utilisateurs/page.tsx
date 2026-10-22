import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteStaffUser, updateStaffProfile } from '../actions';

export default async function StaffUsersPage({ params }: { params: Promise<{ locale: 'fr' | 'mg' }> }) {
  const { locale } = await params;
  await requireRole(['superadmin']);
  const t = await getTranslations('Auth');
  const admin = createAdminClient();
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone, role, active').order('full_name'),
    admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
  ]);
  const emailById = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? '']));

  return (
    <section>
      <h1>{t('users')}</h1>
      <form action={inviteStaffUser}>
        <input type="hidden" name="locale" value={locale} />
        <label>{t('fullName')}<input name="fullName" maxLength={120} required /></label>
        <label>{t('phone')}<input name="phone" type="tel" pattern="03[23478][0-9]{7}" required /></label>
        <label>{t('email')}<input name="email" type="email" required /></label>
        <label>{t('role')}<select name="role" defaultValue="livreur">
          <option value="livreur">{t('courierRole')}</option><option value="admin">{t('adminRole')}</option><option value="superadmin">{t('superadminRole')}</option>
        </select></label>
        <button type="submit">{t('createUser')}</button>
      </form>
      <table>
        <thead><tr><th>{t('fullName')}</th><th>{t('email')}</th><th>{t('phone')}</th><th>{t('role')}</th><th>{t('active')}</th></tr></thead>
        <tbody>
          {(profiles ?? []).map((profile) => (
            <tr key={profile.id}>
              <td>{profile.full_name}</td>
              <td>{emailById.get(profile.id)}</td>
              <td>{profile.phone}</td>
              <td>
                <form action={updateStaffProfile}>
                  <input type="hidden" name="id" value={profile.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <select name="role" defaultValue={profile.role} aria-label={`${t('role')}: ${profile.full_name}`}>
                    <option value="livreur">{t('courierRole')}</option>
                    <option value="admin">{t('adminRole')}</option>
                    <option value="superadmin">{t('superadminRole')}</option>
                  </select>
                  <select name="active" defaultValue={String(profile.active)} aria-label={`${t('active')}: ${profile.full_name}`}>
                    <option value="true">{t('active')}</option>
                    <option value="false">{profile.active ? t('disable') : t('inactive')}</option>
                  </select>
                  <button type="submit">{profile.active ? t('save') : t('approve')}</button>
                </form>
              </td>
              <td>{profile.active ? t('active') : t('inactive')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

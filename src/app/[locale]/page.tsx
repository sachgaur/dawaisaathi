import { redirect } from '@/i18n/routing';

export default async function RootPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;
  redirect({ href: '/dashboard', locale });
}

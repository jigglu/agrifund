import { redirect } from 'next/navigation';

// /dashboard → redirect to investor view as the default portal
export default function DashboardIndex() {
  redirect('/dashboard/investor');
}

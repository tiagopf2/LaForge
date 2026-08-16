import { MemberDetailPage } from './_components/member-detail'

// Next 15 made route params a promise, so the page has to await them.
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MemberDetailPage memberId={id ?? ''} />
}

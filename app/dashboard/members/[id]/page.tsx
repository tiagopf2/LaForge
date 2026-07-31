import { MemberDetailPage } from './_components/member-detail'

export default function MemberPage({ params }: { params: { id: string } }) {
  return <MemberDetailPage memberId={params?.id ?? ''} />
}

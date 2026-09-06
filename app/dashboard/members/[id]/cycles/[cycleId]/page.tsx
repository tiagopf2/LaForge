import { MemberCyclePage } from './_components/member-cycle'

// Next 15 made route params a promise, so the page has to await them.
export default async function CyclePage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>
}) {
  const { id, cycleId } = await params
  return <MemberCyclePage memberId={id ?? ''} cycleId={cycleId ?? ''} />
}

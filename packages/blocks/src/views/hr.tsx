import { useStyles } from '../styles'

export function HrView() {
  const S = useStyles().hr
  return <hr className={S.hr} />
}

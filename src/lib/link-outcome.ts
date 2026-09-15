import { createContext, useContext } from 'react'
import type { LinkResult } from '../../shared/ipc'

export type LinkOutcomeHandler = (outcome: LinkResult, href: string) => void

/** Set at the App level so a click deep in rendered Markdown can surface a banner. */
export const LinkOutcomeContext = createContext<LinkOutcomeHandler>(() => {})

export function useLinkOutcome(): LinkOutcomeHandler {
  return useContext(LinkOutcomeContext)
}

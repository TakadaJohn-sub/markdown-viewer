import { createContext, useContext } from 'react'
import { MESSAGES, type Messages } from '../../shared/i18n'

export const MessagesContext = createContext<Messages>(MESSAGES.en)

export function useMessages(): Messages {
  return useContext(MessagesContext)
}

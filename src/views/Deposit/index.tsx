import { PagePadding } from '@components/Layout/PagePadding'
import { VotingPromptCard } from '@components/VotingPromptCard'
import { OddsDisclaimer } from '@views/Account/OddsDisclaimer'
import { DepositCard } from '@views/Deposit/DepositCard'
import { useTranslation } from 'next-i18next'
import React from 'react'
import { UpcomingPrizeCard } from './UpcomingPrizeCard'

export const DepositUI = () => {
  const { t } = useTranslation()

  return (
    <PagePadding className='flex flex-col space-y-6'>
      <span>{t('thisIsATest')}</span>
      <span>{t('thisIsATestTwo', 'This is a test too')}</span>
      <UpcomingPrizeCard className='mt-4' />
      <DepositCard />
      <VotingPromptCard />
      <OddsDisclaimer />
    </PagePadding>
  )
}

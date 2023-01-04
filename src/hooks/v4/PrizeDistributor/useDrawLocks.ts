import { msToS, sToMs } from '@pooltogether/utilities'
import { PrizeDistributor } from '@pooltogether/v4-client-js'
import { BigNumber } from 'ethers'
import { Dispatch, SetStateAction, useState } from 'react'
import { useQueries } from 'react-query'
import { useDrawBeaconPeriod } from '../PrizePoolNetwork/useDrawBeaconPeriod'
import { usePrizeDistributors } from './usePrizeDistributors'

/**
 * Fetches all of the draws stored in the drawcalculator timelocks and checks if they're still locked. Refetches when they're unlocked and polls every 2.5 minutes to check if htey're updated.
 * @returns
 */
export const useDrawLocks = () => {
  const prizeDistributors = usePrizeDistributors()
  const { data: drawBeaconPeriod, isFetched: isDrawBeaconFetched } = useDrawBeaconPeriod()
  const [refetchIntervals, setRefetchIntervals] = useState<{
    [prizeDistributorId: string]: number
  }>({})

  return useQueries(
    prizeDistributors.map((prizeDistributor) => {
      return {
        queryKey: [
          'useDrawLocks',
          prizeDistributor.id(),
          drawBeaconPeriod?.startedAtSeconds.toString()
        ],
        queryFn: () => getDrawLock(prizeDistributor),
        enabled: !!prizeDistributor && isDrawBeaconFetched,
        refetchInterval: refetchIntervals[prizeDistributor.id()] || sToMs(60 * 2.5),
        onSuccess: (data) => handleSettingRefetch(data, setRefetchIntervals)
      }
    })
  )
}

const getDrawLock = async (
  prizeDistributor: PrizeDistributor
): Promise<{
  prizeDistributorId: string
  endTimeSeconds: BigNumber
  drawId: number
} | null> => {
  const result = await prizeDistributor.getTimelockDrawId()

  // If there's no lock, return null
  if (!result) return null

  // If the lock is over, return null
  const endTimeSeconds = result.endTimeSeconds.toNumber()
  const currentTimeSeconds = Math.round(msToS(Date.now()))
  if (endTimeSeconds <= currentTimeSeconds) {
    return null
  }

  return {
    prizeDistributorId: prizeDistributor.id(),
    endTimeSeconds: result.endTimeSeconds.add(1),
    drawId: result.drawId
  }
}

const handleSettingRefetch = (
  data: {
    prizeDistributorId: string
    endTimeSeconds: BigNumber
    drawId: number
  } | null,
  setRefetchIntervals: Dispatch<
    SetStateAction<{
      [prizeDistributorId: string]: number
    }>
  >
) => {
  if (!data) return
  const endTimeSeconds = data.endTimeSeconds.toNumber()
  const currentTimeSeconds = Math.round(msToS(Date.now()))
  if (endTimeSeconds > currentTimeSeconds) {
    const timeDelayMs = sToMs(endTimeSeconds - currentTimeSeconds)
    setRefetchIntervals((prev) => ({
      ...prev,
      [data.prizeDistributorId]: timeDelayMs
    }))
  } else {
    setRefetchIntervals((prev) => ({
      ...prev,
      [data.prizeDistributorId]: undefined
    }))
  }
}

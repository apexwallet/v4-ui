import { TxButton } from '@components/Input/TxButton'
import { PagePadding } from '@components/Layout/PagePadding'
import { ModalTransactionSubmitted } from '@components/Modal/ModalTransactionSubmitted'
import { PrizePoolDepositBalance } from '@components/PrizePoolDepositList/PrizePoolDepositBalance'
import { PrizePoolListItem } from '@components/PrizePoolDepositList/PrizePoolListItem'
import { PrizePoolLabel } from '@components/PrizePoolLabel'
import { CHAIN_ID } from '@constants/misc'
import { NO_REFETCH } from '@constants/query'
import { isAddress } from '@ethersproject/address'
import { useSendTransaction } from '@hooks/useSendTransaction'
import { usePrizeDistributors } from '@hooks/v4/PrizeDistributor/usePrizeDistributors'
import { useSignerGaugeController } from '@hooks/v4/PrizeDistributor/useSignerGaugeController'
import { usePrizePoolsByChainId } from '@hooks/v4/PrizePool/usePrizePoolsByChainId'
import { usePrizePoolTokensByChainId } from '@hooks/v4/PrizePool/usePrizePoolTokensByChainId'
import { Token, TokenWithBalance, usePrizePoolTokens, useTokenBalance } from '@pooltogether/hooks'
import {
  BlockExplorerLink,
  BottomSheet,
  Card,
  ModalTitle,
  NetworkIcon,
  SquareButton,
  SquareButtonSize
} from '@pooltogether/react-components'
import { GaugeController, PrizePool } from '@pooltogether/v4-client-js'
import {
  TransactionState,
  TransactionStatus,
  useTransaction,
  useUsersAddress
} from '@pooltogether/wallet-connection'
import { getAmountFromBigNumber } from '@utils/getAmountFromBigNumber'
import { getAmountFromString } from '@utils/getAmountFromString'
import classNames from 'classnames'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import React, { useState } from 'react'
import { FieldValues, useForm, UseFormRegister } from 'react-hook-form'
import { useQueries, useQuery } from 'react-query'

export const StakeUI = () => {
  const [gaugeController, setGaugeController] = useState<GaugeController>(null)
  const [ticket, setTicket] = useState<Token>(null)
  const [isGaugeEditSheetOpen, setIsGaugeEditSheetOpen] = useState<boolean>(false)

  return (
    <PagePadding className='flex flex-col space-y-6'>
      <GaugeControllers
        openEditModal={() => setIsGaugeEditSheetOpen(true)}
        setTicket={setTicket}
        setGaugeController={setGaugeController}
      />
      <GaugeEditSheet
        gaugeController={gaugeController}
        ticket={ticket}
        isOpen={isGaugeEditSheetOpen}
        closeModal={() => setIsGaugeEditSheetOpen(false)}
      />
    </PagePadding>
  )
}

const GaugeControllers: React.FC<{
  setGaugeController: (gaugeController: GaugeController) => void
  setTicket: (ticket: Token) => void
  openEditModal: () => void
}> = (props) => {
  const queriesResults = useAllGaugeControllers()
  const [isGaugeStakeSheetOpen, setIsGaugeStakeSheetOpen] = useState<boolean>(false)
  const { setGaugeController, setTicket, openEditModal } = props
  return (
    <>
      {queriesResults.map((queryResults, index) => {
        const { isFetched, data: gaugeController } = queryResults
        if (!isFetched) return <div key={`gauge-controller-${index}`}>Loading...</div>

        return (
          <>
            <GaugeControllerCard
              openEditModal={openEditModal}
              openStakeModal={() => setIsGaugeStakeSheetOpen(true)}
              setGaugeController={setGaugeController}
              setTicket={setTicket}
              key={`gauge-controller-${gaugeController?.id()}`}
              gaugeController={gaugeController}
            />
            <GaugeStakeSheet
              gaugeController={gaugeController}
              isOpen={isGaugeStakeSheetOpen}
              closeModal={() => setIsGaugeStakeSheetOpen(false)}
            />
          </>
        )
      })}
    </>
  )
}

const GaugeControllerCard: React.FC<{
  gaugeController: GaugeController
  setGaugeController: (gaugeController: GaugeController) => void
  setTicket: (ticket: Token) => void
  openEditModal: () => void
  openStakeModal: () => void
}> = (props) => {
  const { gaugeController, setGaugeController, setTicket, openEditModal, openStakeModal } = props
  const prizePools = usePrizePoolsByChainId(gaugeController?.chainId)
  const usersAddress = useUsersAddress()
  const { data: gaugeStakedBalance } = useUsersGaugeControllerBalance(usersAddress, gaugeController)
  const { data: gaugeTokenBalance } = useUsersGaugeTokenBalance(usersAddress, gaugeController)
  const { data: allowance } = useUsersGaugeDepositAllowance(usersAddress, gaugeController)
  const { data: token } = useGaugeToken(gaugeController)

  const allowanceAmount = getAmountFromBigNumber(allowance?.allowanceUnformatted, token?.decimals)
  const stakedAmount = getAmountFromBigNumber(gaugeStakedBalance, token?.decimals)
  const balanceAmount = getAmountFromBigNumber(gaugeTokenBalance, token?.decimals)

  return (
    <div className='rounded-lg p-4 space-y-4 bg-pt-purple-lightest dark:bg-pt-purple'>
      <div className='flex justify-between'>
        <div>
          <div className='space-x-2 flex items-center'>
            <NetworkIcon chainId={gaugeController?.chainId} />
            <span className='font-bold text-lg '>Gauge Controller</span>
          </div>
          <div className='space-x-2 flex items-center'>
            <BlockExplorerLink
              address={gaugeController?.address}
              chainId={gaugeController?.chainId}
              copyable
              shorten
            />
          </div>
        </div>
        <div>
          <SquareButton
            onClick={openStakeModal}
            size={SquareButtonSize.sm}
          >{`Stake ${token?.symbol}`}</SquareButton>
        </div>
      </div>

      <div className='bg-white rounded bg-opacity-10 p-4'>
        <div className='flex justify-between'>
          <span>{`${token?.symbol} balance`}</span>
          <span>{balanceAmount?.amountPretty}</span>
        </div>
        <div className='flex justify-between'>
          <span>{`Staked ${token?.symbol}`}</span>
          <span>{stakedAmount?.amountPretty}</span>
        </div>
        <div className='flex justify-between'>
          <span>Allowance</span>
          <span>{allowanceAmount?.amountPretty}</span>
        </div>
      </div>
      <div className='space-y-2'>
        <div className='font-bold'>Prize Pool Gauges</div>
        <ul className='space-y-4'>
          {prizePools.map((prizePool) => (
            <GaugeRow
              key={`gauge-row-${prizePool.id()}-${gaugeController?.id()}`}
              gaugeController={gaugeController}
              prizePool={prizePool}
              setGaugeController={setGaugeController}
              setTicket={setTicket}
              openModal={openEditModal}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

const GaugeRow: React.FC<{
  gaugeController: GaugeController
  prizePool: PrizePool
  setGaugeController: (gaugeController: GaugeController) => void
  setTicket: (ticket: Token) => void
  openModal: () => void
}> = (props) => {
  const { gaugeController, prizePool, setGaugeController, setTicket, openModal } = props
  const usersAddress = useUsersAddress()
  const { data: tokens } = usePrizePoolTokens(prizePool)
  const { data: balance } = useUsersGaugeBalance(
    usersAddress,
    tokens?.ticket.address,
    gaugeController
  )
  const { data: token } = useGaugeToken(gaugeController)

  const tokenWithBalance = makeTokenWithBalance(token, balance)

  return (
    <PrizePoolListItem
      left={<PrizePoolLabel prizePool={prizePool} />}
      right={
        <PrizePoolDepositBalance chainId={gaugeController?.chainId} token={tokenWithBalance} />
      }
      onClick={() => {
        setTicket(tokens.ticket)
        setGaugeController(gaugeController)
        openModal()
      }}
    />
  )
}

interface GaugeEditSheetProps {
  gaugeController: GaugeController
  ticket: Token
  isOpen: boolean
  closeModal: () => void
}

const GaugeEditSheet: React.FC<GaugeEditSheetProps> = (props) => {
  const { gaugeController, ticket, isOpen, closeModal } = props
  return (
    <BottomSheet
      open={isOpen}
      onDismiss={closeModal}
      label='Gauge edit modal'
      className='space-y-4'
    >
      <ModalTitle chainId={gaugeController?.chainId} title={'Edit Gauge'} />

      <GaugeEditForm gaugeController={gaugeController} ticket={ticket} />
    </BottomSheet>
  )
}

const GAUGE_EDIT_KEY = 'gauge-edit'

// TODO: Ensure allowance is valid before rendering this form.
const GaugeEditForm: React.FC<{
  gaugeController: GaugeController
  ticket: Token
}> = (props) => {
  const { gaugeController: _gaugeController, ticket } = props
  const gaugeController = useSignerGaugeController(_gaugeController)
  const {
    handleSubmit,
    register,
    setValue,
    trigger,
    formState: { errors, isValid }
  } = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  })
  const sendTx = useSendTransaction()
  const usersAddress = useUsersAddress()
  const [transactionId, setTransactionId] = useState('')
  const transaction = useTransaction(transactionId)
  const { data: token } = useGaugeToken(gaugeController)
  const { data: balanceUnformatted, refetch: refetchGaugeBalance } = useUsersGaugeBalance(
    usersAddress,
    ticket?.address,
    gaugeController
  )

  const valitdationRules = {
    // isValidAddress: (x: string) =>
    //   isAddress(x) ? true : 'Please enter a valid address'
  }

  const errorMessage = errors?.[GAUGE_EDIT_KEY]?.message

  const sendGaugeEditTx = async (x: FieldValues) => {
    const amount = x[GAUGE_EDIT_KEY]
    const amountUnformatted = parseUnits(amount, token?.decimals)

    let callTransaction
    if (amountUnformatted.gt(balanceUnformatted)) {
      const differenceUnformatted = amountUnformatted.sub(balanceUnformatted)
      callTransaction = () => gaugeController.increaseGauge(ticket?.address, differenceUnformatted)
    } else {
      const differenceUnformatted = balanceUnformatted.sub(amountUnformatted)
      callTransaction = () => gaugeController.decreaseGauge(ticket?.address, differenceUnformatted)
    }

    const transactionId = await sendTx({
      name: 'Edit Gauge',
      callTransaction,
      callbacks: {
        refetch: () => {
          refetchGaugeBalance()
        }
      }
    })
    setTransactionId(transactionId)
  }

  if (
    transaction?.status === TransactionStatus.pendingBlockchainConfirmation ||
    transaction?.status === TransactionStatus.success
  ) {
    return (
      <>
        <ModalTransactionSubmitted chainId={gaugeController?.chainId} tx={transaction} />
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit(sendGaugeEditTx)} className='flex flex-col'>
      <Input
        inputKey={GAUGE_EDIT_KEY}
        register={register}
        validate={valitdationRules}
        autoComplete='off'
      />
      <div className='h-8 text-pt-red text-center'>
        <span>{errorMessage}</span>
      </div>
      <TxButton
        chainId={gaugeController?.chainId}
        className='w-full'
        type='submit'
        disabled={!isValid || !ticket || !token}
      >
        Update Gauge
      </TxButton>
    </form>
  )
}

interface GaugeStakeSheetProps {
  gaugeController: GaugeController
  isOpen: boolean
  closeModal: () => void
}

const GaugeStakeSheet: React.FC<GaugeStakeSheetProps> = (props) => {
  const { gaugeController, isOpen, closeModal } = props
  return (
    <BottomSheet open={isOpen} onDismiss={closeModal} label='Gauge stake modal'>
      <ModalTitle chainId={gaugeController?.chainId} title={'Stake POOL'} />
      <GaugeStakeForm gaugeController={gaugeController} />
    </BottomSheet>
  )
}

const GaugeStakeForm: React.FC<{ gaugeController: GaugeController }> = (props) => {
  const { gaugeController: _gaugeController } = props
  const gaugeController = useSignerGaugeController(_gaugeController)
  const {
    handleSubmit,
    register,
    setValue,
    trigger,
    formState: { errors, isValid }
  } = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  })
  const sendTx = useSendTransaction()
  const usersAddress = useUsersAddress()
  const [transactionId, setTransactionId] = useState('')
  const transaction = useTransaction(transactionId)
  const { data: token } = useGaugeToken(gaugeController)
  const { refetch: refetchGaugeTokenBalance } = useUsersGaugeTokenBalance(
    usersAddress,
    gaugeController
  )

  const { data: balanceUnformatted, refetch: refetchGaugeBalance } = useUsersGaugeControllerBalance(
    usersAddress,
    gaugeController
  )

  const valitdationRules = {
    // isValidAddress: (x: string) =>
    //   isAddress(x) ? true : 'Please enter a valid address'
  }

  const errorMessage = errors?.[GAUGE_EDIT_KEY]?.message

  const sendGaugeEditTx = async (x: FieldValues) => {
    const amount = x[GAUGE_EDIT_KEY]
    const amountUnformatted = parseUnits(amount, token?.decimals)

    let callTransaction
    if (amountUnformatted.gt(balanceUnformatted)) {
      const differenceUnformatted = amountUnformatted.sub(balanceUnformatted)
      callTransaction = () => gaugeController.deposit(differenceUnformatted)
    } else {
      const differenceUnformatted = balanceUnformatted.sub(amountUnformatted)
      callTransaction = () => gaugeController.withdraw(differenceUnformatted)
    }

    const transactionId = await sendTx({
      name: 'Edit Gauge',
      callTransaction,
      callbacks: {
        refetch: () => {
          refetchGaugeBalance()
          refetchGaugeTokenBalance()
        }
      }
    })
    setTransactionId(transactionId)
  }

  if (
    transaction?.status === TransactionStatus.pendingBlockchainConfirmation ||
    transaction?.status === TransactionStatus.success
  ) {
    return (
      <>
        <ModalTransactionSubmitted chainId={gaugeController?.chainId} tx={transaction} />
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit(sendGaugeEditTx)} className='flex flex-col'>
      <Input
        inputKey={GAUGE_EDIT_KEY}
        register={register}
        validate={valitdationRules}
        autoComplete='off'
      />
      <div className='h-8 text-pt-red text-center'>
        <span>{errorMessage}</span>
      </div>
      <TxButton
        chainId={gaugeController?.chainId}
        className='w-full'
        type='submit'
        disabled={!isValid || !token}
      >
        Update Gauge
      </TxButton>
    </form>
  )
}

interface InputProps {
  inputKey: string
  register: UseFormRegister<FieldValues>
  autoComplete?: string
  validate: {
    [key: string]: (value: string) => boolean | string
  }
}

const Input = (props: InputProps) => {
  const { inputKey, register, validate, autoComplete } = props
  return (
    <div
      className={classNames(
        'p-0.5 bg-body rounded-lg overflow-hidden',
        'transition-all hover:bg-gradient-cyan focus-within:bg-pt-gradient',
        'cursor-pointer'
      )}
    >
      <div className='bg-body w-full rounded-lg flex'>
        <input
          className={classNames(
            'bg-transparent w-full outline-none focus:outline-none active:outline-none py-4 pr-8 pl-4 font-semibold'
          )}
          placeholder='1000'
          autoComplete={autoComplete}
          {...register(inputKey, { required: true, validate })}
        />
      </div>
    </div>
  )
}

///////////////////////// Methods

const makeTokenWithBalance = (
  token: Token | undefined,
  balanceUnformatted: BigNumber | undefined
): TokenWithBalance => {
  if (!token || !balanceUnformatted) return undefined
  const amount = getAmountFromBigNumber(balanceUnformatted, token.decimals)
  return {
    ...amount,
    ...token,
    hasBalance: !balanceUnformatted.isZero()
  }
}

/////////////////// HOOKS

const useAllGaugeControllers = () => {
  const prizeDistributors = usePrizeDistributors()
  return useQueries(
    prizeDistributors.map((prizeDistributor) => ({
      ...NO_REFETCH,
      queryKey: ['useAllGaugeControllers', prizeDistributor.id()],
      queryFn: () => prizeDistributor.getGaugeController()
    }))
  )
}

const useAllUsersGaugeDepositAllowances = (usersAddress: string) => {
  const queriesResults = useAllGaugeControllers()
  return useQueries(
    queriesResults.map(({ data: gaugeController, isFetched }) => ({
      ...NO_REFETCH,
      enabled: isFetched,
      queryKey: ['useAllUsersGaugeDepositAllowances', gaugeController?.id(), usersAddress],
      queryFn: () => gaugeController.getUsersDepositAllowance(usersAddress)
    }))
  )
}

const useUsersGaugeDepositAllowance = (usersAddress: string, gaugeController: GaugeController) => {
  return useQuery(
    ['useAllUsersGaugeDepositAllowances', gaugeController?.id(), usersAddress],
    () => gaugeController.getUsersDepositAllowance(usersAddress),
    { ...NO_REFETCH, enabled: !!gaugeController && !!usersAddress }
  )
}

const useUsersGaugeBalance = (
  usersAddress: string,
  ticketAddress: string,
  gaugeController: GaugeController
) => {
  return useQuery(
    ['useUsersGaugeBalance', gaugeController?.id(), usersAddress, ticketAddress],
    () => gaugeController.getGaugeBalance(usersAddress, ticketAddress),
    { ...NO_REFETCH, enabled: !!gaugeController && !!usersAddress && !!ticketAddress }
  )
}

const useUsersGaugeTokenBalance = (usersAddress: string, gaugeController: GaugeController) => {
  return useQuery(
    ['useUsersGaugeTokenBalance', gaugeController?.id(), usersAddress],
    () => gaugeController.getUsersGaugeTokenBalance(usersAddress),
    { ...NO_REFETCH, enabled: !!gaugeController && !!usersAddress }
  )
}

const useUsersGaugeControllerBalance = (usersAddress: string, gaugeController: GaugeController) => {
  return useQuery(
    ['useUsersGaugeControllerBalance', gaugeController?.id(), usersAddress],
    () => gaugeController.getGaugeControllerBalance(usersAddress),
    { ...NO_REFETCH, enabled: !!gaugeController && !!usersAddress }
  )
}

const useGaugeToken = (gaugeController: GaugeController) => {
  return useQuery(
    ['useGaugeToken', gaugeController?.id()],
    () => gaugeController.getGaugeTokenData(),
    {
      ...NO_REFETCH,
      enabled: !!gaugeController
    }
  )
}

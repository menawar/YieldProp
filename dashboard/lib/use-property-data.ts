'use client'

import { useReadContract, useAccount } from 'wagmi'
import { usePropertyContracts } from '@/lib/property-context'
import { ABIS } from '@/lib/contracts'

export function usePropertyData() {
    const { address } = useAccount()
    const contracts = usePropertyContracts()

    // PropertySale contract reads
    const { data: saleActiveRaw, isLoading: isLoadingSaleActive } = useReadContract({
        address: contracts.PropertySale,
        abi: ABIS.PropertySale,
        functionName: 'saleActive',
    })
    const saleActive = saleActiveRaw as unknown as boolean | undefined

    const { data: tokensOfferedForSaleRaw, isLoading: isLoadingTokensOffered } = useReadContract({
        address: contracts.PropertySale,
        abi: ABIS.PropertySale,
        functionName: 'tokensOfferedForSale',
    })
    const tokensOfferedForSale = tokensOfferedForSaleRaw as unknown as bigint | undefined

    const { data: pricePerTokenRaw, isLoading: isLoadingPrice } = useReadContract({
        address: contracts.PropertySale,
        abi: ABIS.PropertySale,
        functionName: 'pricePerToken',
    })
    const pricePerToken = pricePerTokenRaw as unknown as bigint | undefined

    // PropertyToken contract reads
    const { data: isWhitelistedRaw, isLoading: isLoadingWhitelist } = useReadContract({
        address: contracts.PropertyToken,
        abi: ABIS.PropertyToken,
        functionName: 'isWhitelisted',
        args: address ? [address] : undefined,
    })
    const isWhitelisted = isWhitelistedRaw as unknown as boolean | undefined

    const { data: propertyDetailsRaw, isLoading: isLoadingDetails } = useReadContract({
        address: contracts.PropertyToken,
        abi: ABIS.PropertyToken,
        functionName: 'getPropertyDetails',
    })
    const propertyDetails = propertyDetailsRaw as unknown as [string, string, bigint] | undefined

    // MockUSDC contract reads
    const { data: usdcBalanceRaw, isLoading: isLoadingBalance } = useReadContract({
        address: contracts.MockUSDC,
        abi: ABIS.ERC20,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    })
    const usdcBalance = usdcBalanceRaw as unknown as bigint | undefined

    const { data: saleAllowanceRaw, isLoading: isLoadingSaleAllowance } = useReadContract({
        address: contracts.MockUSDC,
        abi: ABIS.ERC20,
        functionName: 'allowance',
        args: address ? [address, contracts.PropertySale] : undefined,
    })
    const saleAllowance = saleAllowanceRaw as unknown as bigint | undefined

    const { data: yieldDistributorAllowanceRaw, isLoading: isLoadingYieldDistributorAllowance } = useReadContract({
        address: contracts.MockUSDC,
        abi: ABIS.ERC20,
        functionName: 'allowance',
        args: address ? [address, contracts.YieldDistributor] : undefined,
    })
    const yieldDistributorAllowance = yieldDistributorAllowanceRaw as unknown as bigint | undefined

    // PriceManager contract reads
    const { data: currentRentalPriceRaw, isLoading: isLoadingRentalPrice } = useReadContract({
        address: contracts.PriceManager,
        abi: ABIS.PriceManager,
        functionName: 'getCurrentRentalPrice',
    })
    const currentRentalPrice = currentRentalPriceRaw as unknown as bigint | undefined

    const { data: managerRoleRaw, isLoading: isLoadingManagerRole } = useReadContract({
        address: contracts.PriceManager,
        abi: ABIS.PriceManager,
        functionName: 'PROPERTY_MANAGER_ROLE',
    })
    const managerRole = managerRoleRaw as unknown as `0x${string}` | undefined

    const { data: isManagerRaw, isLoading: isLoadingIsManager } = useReadContract({
        address: contracts.PriceManager,
        abi: ABIS.PriceManager,
        functionName: 'hasRole',
        args: address ? [managerRole ?? '0x', address] : undefined,
    })
    const isManager = isManagerRaw as unknown as boolean | undefined

    const { data: paymentProcessorRoleRaw, isLoading: isLoadingPaymentProcessorRole } = useReadContract({
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'PAYMENT_PROCESSOR_ROLE',
    })
    const paymentProcessorRole = paymentProcessorRoleRaw as unknown as `0x${string}` | undefined

    const { data: isPaymentProcessorRaw, isLoading: isLoadingIsPaymentProcessor } = useReadContract({
        address: contracts.YieldDistributor,
        abi: ABIS.YieldDistributor,
        functionName: 'hasRole',
        args: address && paymentProcessorRole ? [paymentProcessorRole, address] : undefined,
    })
    const isPaymentProcessor = isPaymentProcessorRaw as unknown as boolean | undefined

    const isLoading =
        isLoadingSaleActive ||
        isLoadingTokensOffered ||
        isLoadingPrice ||
        isLoadingWhitelist ||
        isLoadingDetails ||
        isLoadingBalance ||
        isLoadingSaleAllowance ||
        isLoadingYieldDistributorAllowance ||
        isLoadingRentalPrice ||
        isLoadingManagerRole ||
        isLoadingIsManager ||
        isLoadingPaymentProcessorRole ||
        isLoadingIsPaymentProcessor

    return {
        saleActive,
        tokensOfferedForSale,
        pricePerToken,
        isWhitelisted,
        propertyDetails,
        usdcBalance,
        saleAllowance,
        yieldDistributorAllowance,
        currentRentalPrice,
        isManager,
        isPaymentProcessor,
        isLoading,
    }
}

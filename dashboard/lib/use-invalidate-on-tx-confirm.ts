'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** Invalidates readContract queries when a transaction is confirmed. Call with isSuccess from useWaitForTransactionReceipt. */
export function useInvalidateOnTxConfirm(txHash: `0x${string}` | undefined, isSuccess: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (txHash && isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['readContract'] })
    }
  }, [txHash, isSuccess, queryClient])
}

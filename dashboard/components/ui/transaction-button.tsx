'use client'

import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useWaitForTransactionReceipt } from 'wagmi'
import { useEffect } from 'react'
import { useInvalidateOnTxConfirm } from '@/lib/use-invalidate-on-tx-confirm'

interface TransactionButtonProps extends ButtonProps {
    txHash?: `0x${string}`
    isPending: boolean
    onSuccess?: () => void
    loadingText?: string
    defaultText: string | React.ReactNode
}

export function TransactionButton({
    txHash,
    isPending,
    onSuccess,
    loadingText = "Confirm in wallet...",
    defaultText,
    disabled,
    ...props
}: TransactionButtonProps) {

    const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    useInvalidateOnTxConfirm(txHash, isTxSuccess)

    useEffect(() => {
        if (isTxSuccess && onSuccess) {
            onSuccess()
        }
    }, [isTxSuccess, onSuccess])

    const isLoading = isPending || isTxPending
    const currentText = isPending ? loadingText : (isTxPending ? "Confirming..." : defaultText)

    return (
        <Button disabled={disabled || isLoading} {...props}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentText}
        </Button>
    )
}
